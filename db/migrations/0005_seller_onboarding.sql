-- TASK 003: additive proposal. Execute only after explicit owner approval.
-- Do not replay the Drizzle journal on a database without migration history.
-- This file does not change enums, existing records, authentication or financial tables.
ALTER TABLE public.seller_profiles
  ADD COLUMN contact_phone varchar(40),
  ADD COLUMN contact_email varchar(320),
  ADD COLUMN contact_address varchar(500),
  ADD COLUMN authorized_representative varchar(200),
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN correction_requested_at timestamptz,
  ADD COLUMN revision integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT seller_profiles_revision_positive CHECK (revision > 0);

ALTER TABLE public.seller_verification_documents
  ADD COLUMN superseded_at timestamptz;

CREATE INDEX seller_profiles_review_queue_idx
  ON public.seller_profiles (verification_status, verification_submitted_at, id);
CREATE INDEX seller_verification_documents_active_idx
  ON public.seller_verification_documents (seller_profile_id)
  WHERE superseded_at IS NULL;
