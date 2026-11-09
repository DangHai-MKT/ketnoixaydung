-- 006.5 proposal. Apply only after separate owner approval, isolated test DB only.
-- No old rows/backfill, enum changes, bank calls or changes to P1 ledger guards.
ALTER TABLE public.payout_accounts
 ADD COLUMN workflow_version integer CHECK (workflow_version IS NULL OR workflow_version=1),
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 ADD COLUMN verified_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
 ADD COLUMN review_reason text;

ALTER TABLE public.withdrawal_requests
 ADD COLUMN workflow_version integer CHECK (workflow_version IS NULL OR workflow_version=1),
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 ADD COLUMN reservation_ledger_id uuid UNIQUE REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
 ADD COLUMN settlement_ledger_id uuid UNIQUE REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
 ADD COLUMN release_ledger_id uuid UNIQUE REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
 ADD CONSTRAINT withdrawal_new_workflow_check CHECK (workflow_version IS NULL OR (
   reservation_ledger_id IS NOT NULL AND payout_account_id IS NOT NULL
   AND (status<>'paid' OR (settlement_ledger_id IS NOT NULL AND paid_at IS NOT NULL))
   AND (status NOT IN ('rejected','failed','cancelled') OR release_ledger_id IS NOT NULL)
 ));
CREATE UNIQUE INDEX withdrawal_new_one_active_seller_uq ON public.withdrawal_requests(seller_id)
 WHERE workflow_version=1 AND status IN ('requested','under_review','approved','processing');

ALTER TABLE public.payout_attempts
 ADD COLUMN workflow_version integer CHECK (workflow_version IS NULL OR workflow_version=1),
 ADD COLUMN evidence_id uuid,
 ADD CONSTRAINT payout_attempts_request_id_uq UNIQUE(withdrawal_request_id,id);
CREATE UNIQUE INDEX payout_attempt_one_active_new_uq ON public.payout_attempts(withdrawal_request_id)
 WHERE workflow_version=1 AND status IN ('pending','processing');

CREATE TABLE public.withdrawal_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 withdrawal_request_id uuid NOT NULL REFERENCES public.withdrawal_requests(id) ON DELETE RESTRICT,
 earning_id uuid NOT NULL REFERENCES public.seller_earnings(id) ON DELETE RESTRICT,
 amount_points bigint NOT NULL CHECK (amount_points>0),
 state varchar(20) NOT NULL CHECK (state IN ('reserved','released','paid')),
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 CONSTRAINT withdrawal_allocations_source_uq UNIQUE(withdrawal_request_id,earning_id),
 CONSTRAINT withdrawal_allocations_finished_check CHECK ((state='reserved' AND finished_at IS NULL) OR (state<>'reserved' AND finished_at IS NOT NULL))
);
CREATE INDEX withdrawal_allocations_earning_idx ON public.withdrawal_allocations(earning_id,state);

CREATE TABLE public.payout_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payout_account_id uuid REFERENCES public.payout_accounts(id) ON DELETE RESTRICT,
 withdrawal_request_id uuid REFERENCES public.withdrawal_requests(id) ON DELETE RESTRICT,
 payout_attempt_id uuid,
 actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 kind varchar(60) NOT NULL CHECK (kind IN ('account_created','account_verified','account_rejected','account_default','account_disabled','account_revealed','document_added','withdrawal_requested','review_started','approved','processing','uncertain','cancelled','rejected','failed','paid')),
 message text NOT NULL CHECK (length(message) BETWEEN 1 AND 10000),
 request_key varchar(150) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT payout_events_target_check CHECK ((payout_account_id IS NOT NULL AND withdrawal_request_id IS NULL AND payout_attempt_id IS NULL) OR (payout_account_id IS NULL AND withdrawal_request_id IS NOT NULL)),
 CONSTRAINT payout_events_attempt_fkey FOREIGN KEY(withdrawal_request_id,payout_attempt_id) REFERENCES public.payout_attempts(withdrawal_request_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX payout_events_account_request_uq ON public.payout_events(payout_account_id,actor_id,request_key) WHERE payout_account_id IS NOT NULL;
CREATE UNIQUE INDEX payout_events_withdrawal_request_uq ON public.payout_events(withdrawal_request_id,actor_id,request_key) WHERE withdrawal_request_id IS NOT NULL;
CREATE INDEX payout_events_withdrawal_timeline_idx ON public.payout_events(withdrawal_request_id,created_at,id);
CREATE INDEX payout_events_account_timeline_idx ON public.payout_events(payout_account_id,created_at,id);

CREATE TABLE public.payout_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL UNIQUE REFERENCES public.payout_events(id) ON DELETE RESTRICT,
 payout_account_id uuid REFERENCES public.payout_accounts(id) ON DELETE RESTRICT,
 withdrawal_request_id uuid REFERENCES public.withdrawal_requests(id) ON DELETE RESTRICT,
 payout_attempt_id uuid,
 uploaded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 kind varchar(40) NOT NULL CHECK (kind IN ('account_ownership','transfer_receipt','failure_confirmation')),
 storage_key varchar(200) NOT NULL UNIQUE,
 original_filename varchar(255) NOT NULL,
 mime_type varchar(100) NOT NULL CHECK (mime_type='image/png'),
 size_bytes bigint NOT NULL CHECK (size_bytes>0 AND size_bytes<=5242880),
 sha256 varchar(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT payout_documents_target_check CHECK ((kind='account_ownership' AND payout_account_id IS NOT NULL AND withdrawal_request_id IS NULL AND payout_attempt_id IS NULL) OR (kind IN ('transfer_receipt','failure_confirmation') AND payout_account_id IS NULL AND withdrawal_request_id IS NOT NULL AND payout_attempt_id IS NOT NULL)),
 CONSTRAINT payout_documents_attempt_fkey FOREIGN KEY(withdrawal_request_id,payout_attempt_id) REFERENCES public.payout_attempts(withdrawal_request_id,id) ON DELETE RESTRICT
);
ALTER TABLE public.payout_attempts ADD CONSTRAINT payout_attempts_evidence_fkey FOREIGN KEY(evidence_id) REFERENCES public.payout_documents(id) ON DELETE RESTRICT;
CREATE INDEX payout_documents_account_idx ON public.payout_documents(payout_account_id,created_at);
CREATE INDEX payout_documents_withdrawal_idx ON public.payout_documents(withdrawal_request_id,created_at);

CREATE FUNCTION public.guard_payout_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Payout history is append-only'; END;
$$;
CREATE TRIGGER payout_events_immutable BEFORE UPDATE OR DELETE ON public.payout_events FOR EACH ROW EXECUTE FUNCTION public.guard_payout_history();
CREATE TRIGGER payout_documents_immutable BEFORE UPDATE OR DELETE ON public.payout_documents FOR EACH ROW EXECUTE FUNCTION public.guard_payout_history();

CREATE FUNCTION public.guard_withdrawal_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Withdrawal allocations cannot be deleted'; END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.withdrawal_request_id IS DISTINCT FROM OLD.withdrawal_request_id OR NEW.earning_id IS DISTINCT FROM OLD.earning_id OR NEW.amount_points IS DISTINCT FROM OLD.amount_points OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.state<>'reserved' OR NEW.state NOT IN ('released','paid') THEN RAISE EXCEPTION 'Invalid allocation mutation'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER withdrawal_allocation_immutable BEFORE UPDATE OR DELETE ON public.withdrawal_allocations FOR EACH ROW EXECUTE FUNCTION public.guard_withdrawal_allocation();

CREATE FUNCTION public.guard_withdrawal_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND OLD.workflow_version=1 THEN RAISE EXCEPTION 'Withdrawal history cannot be deleted'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF OLD.workflow_version=1 AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.seller_id IS DISTINCT FROM OLD.seller_id OR NEW.workflow_version IS DISTINCT FROM OLD.workflow_version OR NEW.amount_vnd IS DISTINCT FROM OLD.amount_vnd OR NEW.points_reserved IS DISTINCT FROM OLD.points_reserved OR NEW.conversion_rate_version IS DISTINCT FROM OLD.conversion_rate_version OR NEW.payout_account_id IS DISTINCT FROM OLD.payout_account_id OR NEW.payout_account_snapshot IS DISTINCT FROM OLD.payout_account_snapshot OR NEW.reservation_ledger_id IS DISTINCT FROM OLD.reservation_ledger_id OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.requested_at IS DISTINCT FROM OLD.requested_at) THEN RAISE EXCEPTION 'Withdrawal identity and snapshot are immutable'; END IF;
 IF OLD.workflow_version=1 AND OLD.status IN ('paid','rejected','failed','cancelled') THEN RAISE EXCEPTION 'Completed withdrawal is immutable'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER withdrawal_identity_immutable BEFORE UPDATE OR DELETE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.guard_withdrawal_identity();

CREATE FUNCTION public.assert_withdrawal_allocations() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE request_id uuid; request_row public.withdrawal_requests%ROWTYPE; total numeric; expected_state text; source_row record; source_net bigint; source_owner uuid;
BEGIN
 IF TG_TABLE_NAME='withdrawal_requests' THEN request_id:=NEW.id;
 ELSIF TG_TABLE_NAME='withdrawal_allocations' THEN request_id:=NEW.withdrawal_request_id;
 ELSE
   FOR source_row IN SELECT DISTINCT withdrawal_request_id FROM public.withdrawal_allocations WHERE earning_id=NEW.id LOOP
     SELECT COALESCE(sum(amount_points),0) INTO total FROM public.withdrawal_allocations WHERE earning_id=NEW.id AND state IN ('reserved','paid');
     IF total>NEW.net_points OR (total>0 AND NEW.status IN ('held','reversed')) THEN RAISE EXCEPTION 'Earning allocation source is inconsistent'; END IF;
   END LOOP;
   RETURN NULL;
 END IF;
 SELECT * INTO request_row FROM public.withdrawal_requests WHERE id=request_id;
 IF request_row.workflow_version IS DISTINCT FROM 1 THEN RETURN NULL; END IF;
 SELECT COALESCE(sum(amount_points),0) INTO total FROM public.withdrawal_allocations WHERE withdrawal_request_id=request_id;
 IF total<>request_row.points_reserved THEN RAISE EXCEPTION 'Withdrawal allocation total mismatch'; END IF;
 expected_state:=CASE WHEN request_row.status='paid' THEN 'paid' WHEN request_row.status IN ('rejected','failed','cancelled') THEN 'released' ELSE 'reserved' END;
 IF EXISTS(SELECT 1 FROM public.withdrawal_allocations a JOIN public.seller_earnings e ON e.id=a.earning_id WHERE a.withdrawal_request_id=request_id AND (a.state<>expected_state OR e.seller_id<>request_row.seller_id)) THEN RAISE EXCEPTION 'Withdrawal allocation owner or state mismatch'; END IF;
 FOR source_row IN SELECT DISTINCT e.id FROM public.seller_earnings e JOIN public.withdrawal_allocations a ON a.earning_id=e.id WHERE a.withdrawal_request_id=request_id ORDER BY e.id LOOP
   SELECT net_points,seller_id INTO source_net,source_owner FROM public.seller_earnings WHERE id=source_row.id FOR UPDATE;
   IF source_owner<>request_row.seller_id THEN RAISE EXCEPTION 'Withdrawal source owner mismatch'; END IF;
   SELECT COALESCE(sum(amount_points),0) INTO total FROM public.withdrawal_allocations WHERE earning_id=source_row.id AND state IN ('reserved','paid');
   IF total>source_net THEN RAISE EXCEPTION 'Earning is over-allocated'; END IF;
 END LOOP;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER withdrawal_allocations_on_request AFTER INSERT OR UPDATE ON public.withdrawal_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.assert_withdrawal_allocations();
CREATE CONSTRAINT TRIGGER withdrawal_allocations_on_item AFTER INSERT OR UPDATE ON public.withdrawal_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.assert_withdrawal_allocations();
CREATE CONSTRAINT TRIGGER withdrawal_allocations_on_earning AFTER UPDATE ON public.seller_earnings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.assert_withdrawal_allocations();
