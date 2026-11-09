-- 0002_ledger_concurrency_hardening.sql
-- Draft for disposable-database testing only.

CREATE OR REPLACE FUNCTION guard_ledger_entry_mutation()
RETURNS trigger AS $$
DECLARE
  tx_status ledger_status;
  tx_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO tx_status
    FROM ledger_transactions
    WHERE id = NEW.transaction_id
    FOR UPDATE;

    IF tx_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION
        'Ledger entries can only be inserted into pending transactions';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT status INTO tx_status
    FROM ledger_transactions
    WHERE id = OLD.transaction_id
    FOR UPDATE;

    IF tx_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION
        'Ledger entries for non-pending transactions are immutable';
    END IF;

    RETURN OLD;
  END IF;

  -- Lock both parent transactions in deterministic UUID order.
  FOR tx_id IN
    SELECT DISTINCT candidate_id
    FROM unnest(
      ARRAY[OLD.transaction_id, NEW.transaction_id]
    ) AS candidates(candidate_id)
    ORDER BY candidate_id
  LOOP
    SELECT status INTO tx_status
    FROM ledger_transactions
    WHERE id = tx_id
    FOR UPDATE;

    IF tx_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION
        'Ledger entries can only reference pending transactions';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION assert_ledger_transaction_balanced()
RETURNS trigger AS $$
DECLARE
  tx_id uuid;
  tx_ids uuid[];
  tx_status ledger_status;
  imbalance_count integer;
BEGIN
  IF TG_TABLE_NAME = 'ledger_transactions' THEN
    IF TG_OP = 'DELETE' THEN
      tx_ids := ARRAY[OLD.id];
    ELSE
      tx_ids := ARRAY[NEW.id];
    END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      tx_ids := ARRAY[NEW.transaction_id];
    ELSIF TG_OP = 'UPDATE' THEN
      tx_ids := ARRAY[OLD.transaction_id, NEW.transaction_id];
    ELSE
      tx_ids := ARRAY[OLD.transaction_id];
    END IF;
  END IF;

  FOREACH tx_id IN ARRAY tx_ids
  LOOP
    SELECT status INTO tx_status
    FROM ledger_transactions
    WHERE id = tx_id;

    IF tx_status = 'posted' THEN
      SELECT count(*) INTO imbalance_count
      FROM (
        SELECT w.unit, sum(le.amount) AS total
        FROM ledger_entries le
        JOIN wallets w ON w.id = le.wallet_id
        WHERE le.transaction_id = tx_id
        GROUP BY w.unit
        HAVING sum(le.amount) <> 0
      ) AS imbalance;

      IF imbalance_count > 0 THEN
        RAISE EXCEPTION
          'Ledger transaction % is not balanced per unit', tx_id;
      END IF;

      IF (
        SELECT count(*)
        FROM ledger_entries
        WHERE transaction_id = tx_id
      ) < 2 THEN
        RAISE EXCEPTION
          'Posted ledger transaction % requires at least two entries',
          tx_id;
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
