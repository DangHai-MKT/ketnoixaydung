CREATE TABLE company_contact_access (
  buyer_id uuid NOT NULL REFERENCES users(id),
  company_id uuid NOT NULL REFERENCES partner_companies(id),
  ledger_id uuid NOT NULL UNIQUE REFERENCES ledger_transactions(id),
  price_points bigint NOT NULL CHECK (price_points = 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_id, company_id)
);
