-- 0001_hardening.sql
-- Apply after 0000_initial.sql, on a disposable/test database first.

ALTER TABLE project_versions
  ADD COLUMN province_code varchar(20),
  ADD COLUMN district_name varchar(120),
  ADD COLUMN project_stage varchar(80),
  ADD COLUMN size_min_sqm numeric(14,2),
  ADD COLUMN size_max_sqm numeric(14,2);
--> statement-breakpoint


ALTER TABLE project_versions
  ADD CONSTRAINT project_versions_size_min_nonnegative
    CHECK (size_min_sqm IS NULL OR size_min_sqm >= 0),
  ADD CONSTRAINT project_versions_size_max_nonnegative
    CHECK (size_max_sqm IS NULL OR size_max_sqm >= 0),
  ADD CONSTRAINT project_versions_size_range_valid
    CHECK (size_min_sqm IS NULL OR size_max_sqm IS NULL OR size_max_sqm >= size_min_sqm);
--> statement-breakpoint


ALTER TABLE payment_orders
  ADD COLUMN client_idempotency_key varchar(200);
--> statement-breakpoint


CREATE UNIQUE INDEX payment_user_idempotency_uq
  ON payment_orders(user_id, client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;
--> statement-breakpoint


CREATE TABLE payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  account_holder varchar(200) NOT NULL,
  bank_name varchar(200) NOT NULL,
  account_number_encrypted text NOT NULL,
  account_number_masked varchar(80) NOT NULL,
  bank_code varchar(50),
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','rejected','disabled')),
  is_default boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint


CREATE INDEX payout_accounts_user_idx ON payout_accounts(user_id, created_at DESC);
--> statement-breakpoint

CREATE UNIQUE INDEX payout_accounts_one_default_per_user_uq
  ON payout_accounts(user_id) WHERE is_default = true;
--> statement-breakpoint


ALTER TABLE withdrawal_requests
  ADD COLUMN payout_account_id uuid REFERENCES payout_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN idempotency_key varchar(200);
--> statement-breakpoint


UPDATE withdrawal_requests
SET idempotency_key = 'legacy-' || id::text
WHERE idempotency_key IS NULL;
--> statement-breakpoint


ALTER TABLE withdrawal_requests
  ALTER COLUMN idempotency_key SET NOT NULL;
--> statement-breakpoint


CREATE UNIQUE INDEX withdrawal_seller_idempotency_uq
  ON withdrawal_requests(seller_id, idempotency_key);
--> statement-breakpoint


CREATE INDEX disputes_open_purchase_idx ON disputes(purchase_id, status);
--> statement-breakpoint

CREATE UNIQUE INDEX disputes_one_open_per_purchase_uq
  ON disputes(purchase_id)
  WHERE status IN ('open','under_review');
--> statement-breakpoint


-- Ledger entries are append-only after posting. Corrections use a new reversing transaction.
CREATE OR REPLACE FUNCTION guard_ledger_entry_mutation()
RETURNS trigger AS $$
DECLARE
  tx_status ledger_status;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO tx_status
    FROM ledger_transactions WHERE id = NEW.transaction_id;
    IF tx_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'Ledger entries can only be inserted into pending transactions';
    END IF;
    RETURN NEW;
  END IF;

  SELECT status INTO tx_status
  FROM ledger_transactions WHERE id = OLD.transaction_id;

  IF tx_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Ledger entries for non-pending transactions are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT status INTO tx_status
  FROM ledger_transactions WHERE id = NEW.transaction_id;
  IF tx_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Ledger entries can only be moved to pending transactions';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint


CREATE TRIGGER ledger_entry_immutability
BEFORE INSERT OR UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION guard_ledger_entry_mutation();
--> statement-breakpoint


CREATE OR REPLACE FUNCTION guard_ledger_transaction_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Only pending ledger transactions may be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Ledger transactions are immutable after leaving pending state';
  END IF;

  IF NEW.status NOT IN ('pending','posted','failed') THEN
    RAISE EXCEPTION 'Invalid ledger transaction state transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint


CREATE TRIGGER ledger_transaction_immutability
BEFORE UPDATE OR DELETE ON ledger_transactions
FOR EACH ROW EXECUTE FUNCTION guard_ledger_transaction_mutation();
