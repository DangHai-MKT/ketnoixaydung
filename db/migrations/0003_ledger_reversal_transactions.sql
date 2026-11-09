-- DRAFT ONLY — review and test on a disposable PostgreSQL database before use.
-- Option B: immutable original transaction + separate full reversal transaction.
-- Do not apply to production until data preflight, service-layer behavior, and tests are approved.

ALTER TABLE ledger_transactions
  ADD COLUMN reversal_of_transaction_id uuid,
  ADD COLUMN reversal_reason text;

ALTER TABLE ledger_entries
  ADD COLUMN reversal_of_entry_id uuid;

ALTER TABLE ledger_transactions
  ADD CONSTRAINT ledger_transactions_reversal_of_fkey
    FOREIGN KEY (reversal_of_transaction_id)
    REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ledger_transactions_reversal_fields_check
    CHECK (
      (transaction_type = 'reversal'
        AND reversal_of_transaction_id IS NOT NULL
        AND reversal_reason IS NOT NULL
        AND btrim(reversal_reason) <> '')
      OR
      (transaction_type <> 'reversal'
        AND reversal_of_transaction_id IS NULL
        AND reversal_reason IS NULL)
    );

ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_reversal_of_entry_fkey
    FOREIGN KEY (reversal_of_entry_id)
    REFERENCES ledger_entries(id) ON DELETE RESTRICT;

-- Failed reversal attempts may remain for audit and must not permanently block a retry.
-- A pending or posted reversal reserves the original transaction; a failed one does not.
CREATE UNIQUE INDEX ledger_transactions_one_active_reversal_per_original_uidx
  ON ledger_transactions (reversal_of_transaction_id)
  WHERE reversal_of_transaction_id IS NOT NULL AND status <> 'failed';

-- Each original entry may be mapped by at most one reversal entry. To permit a retry
-- after a failed attempt, the transaction guard below requires reversal entries to be
-- removed while the attempt is still pending before it can transition to failed.
CREATE UNIQUE INDEX ledger_entries_one_reversal_per_original_entry_uidx
  ON ledger_entries (reversal_of_entry_id)
  WHERE reversal_of_entry_id IS NOT NULL;

-- Preserve the pending-only mutation policy. Validate reversal metadata and lock the
-- original transaction when a reversal is created or posted. The original transaction
-- itself is never changed to 'reversed'.
CREATE OR REPLACE FUNCTION guard_ledger_transaction_mutation()
RETURNS trigger AS $$
DECLARE
  original_type varchar(60);
  original_status ledger_status;
  has_unnegatable_amount boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Only pending ledger transactions may be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Ledger transactions are immutable after leaving pending state';
    END IF;
  END IF;

  IF NEW.status NOT IN ('pending', 'posted', 'failed') THEN
    RAISE EXCEPTION 'Invalid ledger transaction state transition';
  END IF;

  -- A failed reversal must not strand unique entry references and block a retry.
  -- Remove its entries while the transaction is still pending, then mark it failed.
  IF TG_OP = 'UPDATE'
     AND OLD.transaction_type = 'reversal'
     AND NEW.status = 'failed'
     AND EXISTS (
       SELECT 1 FROM ledger_entries WHERE transaction_id = OLD.id
     ) THEN
    RAISE EXCEPTION 'Delete pending reversal entries before marking the reversal failed';
  END IF;

  IF NEW.transaction_type = 'reversal' THEN
    IF NEW.reversal_of_transaction_id IS NULL
       OR NEW.reversal_reason IS NULL
       OR btrim(NEW.reversal_reason) = '' THEN
      RAISE EXCEPTION 'A reversal requires an original transaction and a nonblank reason';
    END IF;

    IF NEW.reversal_of_transaction_id = NEW.id THEN
      RAISE EXCEPTION 'A transaction cannot reverse itself';
    END IF;

    SELECT transaction_type, status
      INTO original_type, original_status
      FROM ledger_transactions
      WHERE id = NEW.reversal_of_transaction_id
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Original ledger transaction % does not exist', NEW.reversal_of_transaction_id;
    END IF;
    IF original_type = 'reversal' THEN
      RAISE EXCEPTION 'A reversal transaction cannot itself be reversed';
    END IF;
    IF original_status <> 'posted' THEN
      RAISE EXCEPTION 'Only a posted ledger transaction may be reversed';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM ledger_entries
      WHERE transaction_id = NEW.reversal_of_transaction_id
        AND amount = '-9223372036854775808'::bigint
    ) INTO has_unnegatable_amount;

    IF has_unnegatable_amount THEN
      RAISE EXCEPTION 'Original transaction % contains a BIGINT minimum amount that cannot be negated', NEW.reversal_of_transaction_id;
    END IF;
  ELSIF NEW.reversal_of_transaction_id IS NOT NULL OR NEW.reversal_reason IS NOT NULL THEN
    RAISE EXCEPTION 'Only reversal transactions may set reversal metadata';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Include INSERT so reversal metadata is validated when a transaction is created.
DROP TRIGGER ledger_transaction_immutability ON ledger_transactions;
CREATE TRIGGER ledger_transaction_immutability
BEFORE INSERT OR UPDATE OR DELETE ON ledger_transactions
FOR EACH ROW EXECUTE FUNCTION guard_ledger_transaction_mutation();

-- Extend the concurrency-safe entry guard from 0002. Every entry mutation locks its
-- parent transaction(s); referenced reversal entries must match the original wallet
-- and exact opposite amount. Incomplete reversal entries are allowed only while pending.
CREATE OR REPLACE FUNCTION guard_ledger_entry_mutation()
RETURNS trigger AS $$
DECLARE
  tx_id uuid;
  parent_status ledger_status;
  parent_type varchar(60);
  parent_original_tx_id uuid;
  original_entry_tx_id uuid;
  original_entry_wallet_id uuid;
  original_entry_amount bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status, transaction_type, reversal_of_transaction_id
      INTO parent_status, parent_type, parent_original_tx_id
      FROM ledger_transactions
      WHERE id = NEW.transaction_id
      FOR UPDATE;

    IF parent_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'Ledger entries can only be inserted into pending transactions';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT status INTO parent_status
      FROM ledger_transactions
      WHERE id = OLD.transaction_id
      FOR UPDATE;

    IF parent_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'Ledger entries for non-pending transactions are immutable';
    END IF;
    RETURN OLD;
  ELSE
    -- Lock both parent transactions in deterministic UUID order to reduce deadlocks.
    FOR tx_id IN
      SELECT DISTINCT candidate_id
      FROM unnest(ARRAY[OLD.transaction_id, NEW.transaction_id]) AS candidates(candidate_id)
      ORDER BY candidate_id
    LOOP
      SELECT status INTO parent_status
        FROM ledger_transactions
        WHERE id = tx_id
        FOR UPDATE;

      IF parent_status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'Ledger entries can only reference pending transactions';
      END IF;
    END LOOP;

    SELECT status, transaction_type, reversal_of_transaction_id
      INTO parent_status, parent_type, parent_original_tx_id
      FROM ledger_transactions
      WHERE id = NEW.transaction_id;
  END IF;

  IF NEW.reversal_of_entry_id IS NOT NULL THEN
    IF parent_type IS DISTINCT FROM 'reversal' OR parent_original_tx_id IS NULL THEN
      RAISE EXCEPTION 'Only reversal transactions may reference original ledger entries';
    END IF;

    SELECT transaction_id, wallet_id, amount
      INTO original_entry_tx_id, original_entry_wallet_id, original_entry_amount
      FROM ledger_entries
      WHERE id = NEW.reversal_of_entry_id;

    IF NOT FOUND OR original_entry_tx_id <> parent_original_tx_id THEN
      RAISE EXCEPTION 'Reversal entry must reference an entry from its declared original transaction';
    END IF;
    IF original_entry_wallet_id <> NEW.wallet_id THEN
      RAISE EXCEPTION 'Reversal entry must use the same wallet as its original entry';
    END IF;
    IF original_entry_amount = '-9223372036854775808'::bigint THEN
      RAISE EXCEPTION 'A BIGINT minimum amount cannot be negated for a reversal';
    END IF;
    IF NEW.amount::numeric <> -original_entry_amount::numeric THEN
      RAISE EXCEPTION 'Reversal entry amount must be the exact opposite of its original entry';
    END IF;
  ELSIF parent_type = 'reversal' THEN
    -- Missing links are tolerated while the reversal is being assembled; the deferred
    -- posting assertion rejects any incomplete mapping before the transaction commits.
    NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The existing entry trigger already calls this function; no trigger recreation needed.

-- Extend the deferred assertion so posting a reversal requires an exact one-to-one mirror.
CREATE OR REPLACE FUNCTION assert_ledger_transaction_balanced()
RETURNS trigger AS $$
DECLARE
  tx_id uuid;
  tx_ids uuid[];
  tx_status ledger_status;
  tx_type varchar(60);
  original_tx_id uuid;
  original_status ledger_status;
  original_type varchar(60);
  imbalance_count integer;
  original_entry_count bigint;
  reversal_entry_count bigint;
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

  FOREACH tx_id IN ARRAY tx_ids LOOP
    SELECT status, transaction_type, reversal_of_transaction_id
      INTO tx_status, tx_type, original_tx_id
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
        RAISE EXCEPTION 'Ledger transaction % is not balanced per unit', tx_id;
      END IF;

      IF (SELECT count(*) FROM ledger_entries WHERE transaction_id = tx_id) < 2 THEN
        RAISE EXCEPTION 'Posted ledger transaction % requires at least two entries', tx_id;
      END IF;

      IF tx_type = 'reversal' THEN
        SELECT transaction_type, status
          INTO original_type, original_status
          FROM ledger_transactions
          WHERE id = original_tx_id;

        IF NOT FOUND OR original_type = 'reversal' OR original_status <> 'posted' THEN
          RAISE EXCEPTION 'Reversal % must reference a posted, non-reversal transaction', tx_id;
        END IF;

        IF EXISTS (
          SELECT 1 FROM ledger_entries
          WHERE transaction_id = original_tx_id
            AND amount = '-9223372036854775808'::bigint
        ) THEN
          RAISE EXCEPTION 'Original transaction % contains a BIGINT minimum amount that cannot be negated', original_tx_id;
        END IF;

        SELECT count(*) INTO original_entry_count
          FROM ledger_entries WHERE transaction_id = original_tx_id;
        SELECT count(*) INTO reversal_entry_count
          FROM ledger_entries WHERE transaction_id = tx_id;

        IF original_entry_count <> reversal_entry_count THEN
          RAISE EXCEPTION 'Reversal % must contain exactly one mirrored entry per original entry', tx_id;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM ledger_entries oe
          WHERE oe.transaction_id = original_tx_id
            AND NOT EXISTS (
              SELECT 1
              FROM ledger_entries re
              WHERE re.transaction_id = tx_id
                AND re.reversal_of_entry_id = oe.id
                AND re.wallet_id = oe.wallet_id
                AND re.amount::numeric = -oe.amount::numeric
            )
        ) THEN
          RAISE EXCEPTION 'Reversal % does not exactly mirror all original entries', tx_id;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM ledger_entries re
          WHERE re.transaction_id = tx_id
            AND (
              re.reversal_of_entry_id IS NULL
              OR NOT EXISTS (
                SELECT 1
                FROM ledger_entries oe
                WHERE oe.id = re.reversal_of_entry_id
                  AND oe.transaction_id = original_tx_id
                  AND oe.wallet_id = re.wallet_id
                  AND re.amount::numeric = -oe.amount::numeric
              )
            )
        ) THEN
          RAISE EXCEPTION 'Reversal % contains an entry that does not match its original entry', tx_id;
        END IF;
      ELSIF EXISTS (
        SELECT 1 FROM ledger_entries
        WHERE transaction_id = tx_id AND reversal_of_entry_id IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Only reversal transactions may reference original ledger entries';
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Existing deferred balance triggers from 0000 call the replaced function.
