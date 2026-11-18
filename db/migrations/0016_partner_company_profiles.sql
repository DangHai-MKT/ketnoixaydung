ALTER TABLE partner_companies
  ADD COLUMN profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN published_at timestamptz;
