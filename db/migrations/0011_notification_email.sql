-- TASK 007.4. Apply only after separate approval for the isolated test database.
CREATE TABLE notification_email_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  seller_enabled_at timestamptz,
  project_enabled_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_email_deliveries (
  notification_id uuid PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
  state varchar(12) NOT NULL CHECK (state IN ('sending','retry','accepted','failed','skipped')),
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 4),
  first_attempt_at timestamptz NOT NULL,
  next_attempt_at timestamptz NOT NULL,
  lease_token uuid,
  payload_hash varchar(64) NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  provider_id varchar(100),
  outcome varchar(40),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state = 'sending') = (lease_token IS NOT NULL)),
  CHECK ((state = 'accepted') = (provider_id IS NOT NULL))
);
CREATE INDEX notification_email_deliveries_due_idx
  ON notification_email_deliveries(next_attempt_at) WHERE state IN ('sending','retry');
CREATE INDEX notifications_email_candidates_idx ON notifications(type, created_at, id);
