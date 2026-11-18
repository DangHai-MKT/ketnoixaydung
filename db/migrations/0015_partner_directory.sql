CREATE TABLE partner_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_key text NOT NULL UNIQUE,
  tax_code text UNIQUE,
  name text NOT NULL,
  trade text NOT NULL,
  province text NOT NULL,
  website text,
  source_url text NOT NULL,
  imported_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
