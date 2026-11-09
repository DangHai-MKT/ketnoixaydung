-- Apply only after approval on the isolated database.
CREATE TABLE project_watch_periods (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  category varchar(100) NOT NULL CHECK (category IN ('civil','industrial','infrastructure','energy','commercial','agriculture','healthcare','education','other')),
  request_id uuid NOT NULL,
  price_points bigint NOT NULL CHECK (price_points = 1000),
  ledger_id uuid NOT NULL UNIQUE REFERENCES ledger_transactions(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  email_enabled boolean NOT NULL DEFAULT false,
  reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at = starts_at + interval '720 hours'),
  UNIQUE(user_id,request_id),
  UNIQUE(user_id,category,starts_at)
);
CREATE INDEX project_watch_periods_category_idx ON project_watch_periods(category,starts_at,ends_at);
CREATE TABLE project_watch_alerts (
  user_id uuid NOT NULL REFERENCES users(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  period_id uuid NOT NULL REFERENCES project_watch_periods(id),
  notification_id uuid NOT NULL UNIQUE REFERENCES notifications(id),
  PRIMARY KEY(user_id,project_id)
);
