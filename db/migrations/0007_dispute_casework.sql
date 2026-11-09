-- 006.3 additive casework proposal. Apply manually only after owner approval.
-- No ledger, wallet, purchase status, earning status or enum changes.
ALTER TABLE public.disputes
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
 ADD COLUMN client_idempotency_key varchar(150);
CREATE UNIQUE INDEX disputes_opening_request_uq ON public.disputes(raised_by,client_idempotency_key)
 WHERE client_idempotency_key IS NOT NULL;

CREATE TABLE public.dispute_case_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 kind varchar(40) NOT NULL CHECK (kind IN ('opened','message','review_started','information_requested','evidence_added')),
 message text NOT NULL CHECK (length(message) BETWEEN 1 AND 10000),
 request_key varchar(150) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dispute_case_events_request_uq UNIQUE(dispute_id,actor_id,request_key),
 CONSTRAINT dispute_case_events_case_id_uq UNIQUE(dispute_id,id)
);
CREATE INDEX dispute_case_events_timeline_idx ON public.dispute_case_events(dispute_id,created_at,id);

CREATE TABLE public.dispute_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE RESTRICT,
 event_id uuid NOT NULL UNIQUE,
 uploaded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 storage_key varchar(200) NOT NULL UNIQUE,
 original_filename varchar(255) NOT NULL,
 mime_type varchar(100) NOT NULL CHECK (mime_type='image/png'),
 size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
 sha256 varchar(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dispute_evidence_event_case_fkey FOREIGN KEY(dispute_id,event_id)
  REFERENCES public.dispute_case_events(dispute_id,id) ON DELETE RESTRICT
);
CREATE INDEX dispute_evidence_case_idx ON public.dispute_evidence(dispute_id,created_at,id);

-- Case history and evidence are append-only. Corrections are new events/files.
CREATE FUNCTION public.guard_dispute_casework_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Dispute casework is append-only'; END;
$$;
CREATE TRIGGER dispute_case_events_immutable BEFORE UPDATE OR DELETE ON public.dispute_case_events
 FOR EACH ROW EXECUTE FUNCTION public.guard_dispute_casework_immutable();
CREATE TRIGGER dispute_evidence_immutable BEFORE UPDATE OR DELETE ON public.dispute_evidence
 FOR EACH ROW EXECUTE FUNCTION public.guard_dispute_casework_immutable();
