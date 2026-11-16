CREATE TABLE partner_requests (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  trade text NOT NULL,
  province text NOT NULL,
  scope text NOT NULL,
  timing text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX partner_requests_owner_idx ON partner_requests (owner_id, created_at DESC);
CREATE INDEX partner_requests_open_idx ON partner_requests (created_at DESC) WHERE closed_at IS NULL;

CREATE TABLE partner_replies (
  request_id uuid NOT NULL REFERENCES partner_requests(id),
  author_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK (kind IN ('interested','referral')),
  PRIMARY KEY (request_id, author_id)
);

CREATE TABLE partner_introductions (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES partner_requests(id),
  staff_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_introductions_request_idx ON partner_introductions (request_id, created_at DESC);
