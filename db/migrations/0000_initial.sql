-- Initial schema for Construction Project Information Marketplace.
-- Review legal/commercial assumptions before processing real money.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint


CREATE TYPE user_status AS ENUM ('active','suspended','closed');
--> statement-breakpoint

CREATE TYPE verification_status AS ENUM ('unverified','pending','verified','rejected','suspended');
--> statement-breakpoint

CREATE TYPE seller_type AS ENUM ('individual','business');
--> statement-breakpoint

CREATE TYPE project_status AS ENUM ('draft','pending_auto_check','needs_correction','pending_review','published','rejected','paused','archived');
--> statement-breakpoint

CREATE TYPE moderation_decision AS ENUM ('approved','rejected','changes_requested','paused','restored');
--> statement-breakpoint

CREATE TYPE wallet_unit AS ENUM ('POINT','VND');
--> statement-breakpoint

CREATE TYPE wallet_bucket AS ENUM ('available','held','platform_clearing','platform_revenue','issuance','seller_payable');
--> statement-breakpoint

CREATE TYPE ledger_status AS ENUM ('pending','posted','reversed','failed');
--> statement-breakpoint

CREATE TYPE payment_status AS ENUM ('pending','paid','failed','expired','partially_refunded','refunded');
--> statement-breakpoint

CREATE TYPE purchase_status AS ENUM ('created','completed','failed','refund_pending','refunded','disputed');
--> statement-breakpoint

CREATE TYPE earning_status AS ENUM ('held','available','reserved','paid','reversed','disputed');
--> statement-breakpoint

CREATE TYPE withdrawal_status AS ENUM ('requested','under_review','approved','processing','paid','rejected','failed','cancelled');
--> statement-breakpoint

CREATE TYPE payout_status AS ENUM ('pending','processing','paid','failed','cancelled');
--> statement-breakpoint

CREATE TYPE dispute_status AS ENUM ('open','under_review','resolved_buyer','resolved_seller','rejected','closed');
--> statement-breakpoint


CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  password_hash text,
  display_name varchar(200) NOT NULL,
  phone varchar(40),
  status user_status NOT NULL DEFAULT 'active',
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);
--> statement-breakpoint

CREATE UNIQUE INDEX users_email_uq ON users(email);
--> statement-breakpoint

CREATE UNIQUE INDEX users_phone_uq ON users(phone) WHERE phone IS NOT NULL;
--> statement-breakpoint


CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(50) NOT NULL CHECK (role IN ('buyer','seller','content_moderator','finance_operator','support_operator','super_admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
--> statement-breakpoint


CREATE TABLE seller_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  seller_type seller_type NOT NULL,
  legal_name varchar(300) NOT NULL,
  business_registration_no varchar(100),
  tax_code varchar(100),
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  verification_submitted_at timestamptz,
  verified_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  review_reason text,
  payout_profile_status verification_status NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (seller_type <> 'business' OR legal_name <> '')
);
--> statement-breakpoint


CREATE TABLE seller_verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_profile_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  document_type varchar(80) NOT NULL,
  storage_key text NOT NULL,
  original_filename varchar(255) NOT NULL,
  mime_type varchar(120) NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint


CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  slug varchar(320) NOT NULL,
  title varchar(300) NOT NULL,
  category varchar(100) NOT NULL,
  province_code varchar(20),
  district_name varchar(120),
  project_stage varchar(80),
  size_min_sqm numeric(14,2),
  size_max_sqm numeric(14,2),
  public_summary text NOT NULL,
  public_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_points bigint NOT NULL CHECK (price_points > 0),
  status project_status NOT NULL DEFAULT 'draft',
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (size_min_sqm IS NULL OR size_min_sqm >= 0),
  CHECK (size_max_sqm IS NULL OR size_max_sqm >= 0),
  CHECK (size_min_sqm IS NULL OR size_max_sqm IS NULL OR size_max_sqm >= size_min_sqm)
);
--> statement-breakpoint

CREATE UNIQUE INDEX projects_slug_uq ON projects(slug);
--> statement-breakpoint

CREATE INDEX projects_status_published_idx ON projects(status, published_at DESC);
--> statement-breakpoint

CREATE INDEX projects_seller_idx ON projects(seller_id, created_at DESC);
--> statement-breakpoint

CREATE INDEX projects_category_province_idx ON projects(category, province_code);
--> statement-breakpoint

CREATE INDEX projects_public_data_gin_idx ON projects USING gin(public_data);
--> statement-breakpoint


CREATE TABLE project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  version_no integer NOT NULL CHECK (version_no > 0),
  title varchar(300) NOT NULL,
  category varchar(100) NOT NULL,
  public_summary text NOT NULL,
  public_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_points bigint NOT NULL CHECK (price_points > 0),
  submitted_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  approved_at timestamptz,
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, version_no)
);
--> statement-breakpoint

CREATE INDEX project_versions_project_idx ON project_versions(project_id, version_no DESC);
--> statement-breakpoint


CREATE TABLE project_private_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_version_id uuid NOT NULL UNIQUE REFERENCES project_versions(id) ON DELETE RESTRICT,
  private_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_rights_confirmed_at timestamptz,
  data_rights_declaration text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint


CREATE TABLE project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_version_id uuid NOT NULL REFERENCES project_versions(id) ON DELETE RESTRICT,
  storage_key text NOT NULL UNIQUE,
  original_filename varchar(255) NOT NULL,
  mime_type varchar(120) NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  access_level varchar(20) NOT NULL CHECK (access_level IN ('public_preview','purchased_only','moderator_only')),
  checksum_sha256 varchar(64),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX project_files_version_idx ON project_files(project_version_id);
--> statement-breakpoint


CREATE TABLE moderation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  project_version_id uuid REFERENCES project_versions(id) ON DELETE RESTRICT,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decision moderation_decision NOT NULL,
  automated_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX moderation_reviews_project_idx ON moderation_reviews(project_id, created_at DESC);
--> statement-breakpoint


-- Each wallet is a ledger account. The signed ledger entries are the source of truth.
CREATE TABLE wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  account_code varchar(100) NOT NULL UNIQUE,
  unit wallet_unit NOT NULL,
  bucket wallet_bucket NOT NULL,
  description text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((is_system AND user_id IS NULL) OR (NOT is_system AND user_id IS NOT NULL))
);
--> statement-breakpoint

CREATE UNIQUE INDEX wallets_user_unit_bucket_uq ON wallets(user_id, unit, bucket) WHERE user_id IS NOT NULL;
--> statement-breakpoint

CREATE INDEX wallets_unit_bucket_idx ON wallets(unit, bucket);
--> statement-breakpoint


CREATE TABLE ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type varchar(60) NOT NULL,
  reference_type varchar(60),
  reference_id uuid,
  idempotency_key varchar(200) UNIQUE,
  status ledger_status NOT NULL DEFAULT 'pending',
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX ledger_reference_idx ON ledger_transactions(reference_type, reference_id);
--> statement-breakpoint

CREATE INDEX ledger_created_idx ON ledger_transactions(created_at DESC);
--> statement-breakpoint


CREATE TABLE ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  amount bigint NOT NULL CHECK (amount <> 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX ledger_entries_transaction_idx ON ledger_entries(transaction_id);
--> statement-breakpoint

CREATE INDEX ledger_entries_wallet_idx ON ledger_entries(wallet_id, created_at DESC);
--> statement-breakpoint


CREATE TABLE payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider varchar(50) NOT NULL,
  provider_reference varchar(200),
  amount_vnd bigint NOT NULL CHECK (amount_vnd > 0),
  points_to_credit bigint NOT NULL CHECK (points_to_credit > 0),
  exchange_rate_version integer NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  checkout_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  refunded_amount_vnd bigint NOT NULL DEFAULT 0 CHECK (refunded_amount_vnd >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_reference),
  CHECK (refunded_amount_vnd <= amount_vnd)
);
--> statement-breakpoint

CREATE INDEX payment_orders_user_idx ON payment_orders(user_id, created_at DESC);
--> statement-breakpoint

CREATE INDEX payment_orders_status_idx ON payment_orders(status, created_at);
--> statement-breakpoint


CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id uuid REFERENCES payment_orders(id) ON DELETE RESTRICT,
  provider varchar(50) NOT NULL,
  provider_event_id varchar(200) NOT NULL,
  event_type varchar(100) NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status varchar(20) NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received','processed','ignored','failed')),
  processing_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(provider, provider_event_id)
);
--> statement-breakpoint


CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  project_version_id uuid NOT NULL REFERENCES project_versions(id) ON DELETE RESTRICT,
  price_points bigint NOT NULL CHECK (price_points > 0),
  fee_bps integer NOT NULL CHECK (fee_bps >= 0 AND fee_bps <= 10000),
  fee_points bigint NOT NULL CHECK (fee_points >= 0),
  seller_points bigint NOT NULL CHECK (seller_points >= 0),
  status purchase_status NOT NULL DEFAULT 'created',
  idempotency_key varchar(200) NOT NULL UNIQUE,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fee_points + seller_points = price_points),
  CHECK (buyer_id <> seller_id),
  UNIQUE(buyer_id, project_version_id)
);
--> statement-breakpoint

CREATE INDEX purchase_orders_seller_idx ON purchase_orders(seller_id, created_at DESC);
--> statement-breakpoint

CREATE INDEX purchase_orders_project_idx ON purchase_orders(project_id, created_at DESC);
--> statement-breakpoint


CREATE TABLE seller_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  purchase_id uuid NOT NULL UNIQUE REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  gross_points bigint NOT NULL CHECK (gross_points >= 0),
  fee_points bigint NOT NULL CHECK (fee_points >= 0),
  net_points bigint NOT NULL CHECK (net_points >= 0),
  status earning_status NOT NULL DEFAULT 'held',
  held_until timestamptz NOT NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (gross_points = fee_points + net_points)
);
--> statement-breakpoint

CREATE INDEX seller_earnings_available_idx ON seller_earnings(seller_id, status, held_until);
--> statement-breakpoint


CREATE TABLE withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_vnd bigint NOT NULL CHECK (amount_vnd > 0),
  points_reserved bigint NOT NULL CHECK (points_reserved > 0),
  conversion_rate_version integer NOT NULL,
  status withdrawal_status NOT NULL DEFAULT 'requested',
  payout_account_snapshot jsonb NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_reason text,
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX withdrawal_requests_seller_idx ON withdrawal_requests(seller_id, requested_at DESC);
--> statement-breakpoint

CREATE INDEX withdrawal_requests_status_idx ON withdrawal_requests(status, requested_at);
--> statement-breakpoint


CREATE TABLE payout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_request_id uuid NOT NULL REFERENCES withdrawal_requests(id) ON DELETE RESTRICT,
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  provider varchar(50),
  provider_reference varchar(200),
  status payout_status NOT NULL DEFAULT 'pending',
  amount_vnd bigint NOT NULL CHECK (amount_vnd > 0),
  failure_reason text,
  initiated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(withdrawal_request_id, attempt_no),
  UNIQUE(provider, provider_reference)
);
--> statement-breakpoint


CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_points bigint NOT NULL CHECK (amount_points > 0),
  reason text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','completed')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  ledger_transaction_id uuid REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint


CREATE TABLE disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  raised_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason_code varchar(80) NOT NULL,
  description text NOT NULL,
  status dispute_status NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  resolution text,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX disputes_status_idx ON disputes(status, created_at);
--> statement-breakpoint


CREATE TABLE system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key varchar(100) NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  value jsonb NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  change_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(setting_key, version),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
--> statement-breakpoint

CREATE INDEX system_settings_effective_idx ON system_settings(setting_key, effective_from, effective_to);
--> statement-breakpoint


CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  entity_type varchar(100) NOT NULL,
  entity_id uuid,
  reason text,
  request_id varchar(100),
  ip_hash varchar(128),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX audit_logs_actor_idx ON audit_logs(actor_id, created_at DESC);
--> statement-breakpoint

CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id, created_at DESC);
--> statement-breakpoint


CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(80) NOT NULL,
  title varchar(200) NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX notifications_user_idx ON notifications(user_id, read_at, created_at DESC);
--> statement-breakpoint


-- Ensure every posted ledger transaction balances to zero for each unit.
-- Trigger is deferred so all entries can be inserted in one SQL transaction.
CREATE OR REPLACE FUNCTION assert_ledger_transaction_balanced() RETURNS trigger AS $$
DECLARE
  tx_id uuid;
  tx_status ledger_status;
  imbalance_count integer;
BEGIN
  IF TG_TABLE_NAME = 'ledger_transactions' THEN
    tx_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    tx_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.transaction_id ELSE NEW.transaction_id END;
  END IF;
  SELECT status INTO tx_status FROM ledger_transactions WHERE id = tx_id;
  IF tx_status = 'posted' THEN
    SELECT count(*) INTO imbalance_count
    FROM (
      SELECT w.unit, sum(le.amount) AS total
      FROM ledger_entries le
      JOIN wallets w ON w.id = le.wallet_id
      WHERE le.transaction_id = tx_id
      GROUP BY w.unit
      HAVING sum(le.amount) <> 0
    ) imbalance;
    IF imbalance_count > 0 THEN
      RAISE EXCEPTION 'Ledger transaction % is not balanced per unit', tx_id;
    END IF;
    IF (SELECT count(*) FROM ledger_entries WHERE transaction_id = tx_id) < 2 THEN
      RAISE EXCEPTION 'Posted ledger transaction % requires at least two entries', tx_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint


CREATE CONSTRAINT TRIGGER ledger_balance_on_entry
AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION assert_ledger_transaction_balanced();
--> statement-breakpoint


CREATE CONSTRAINT TRIGGER ledger_balance_on_transaction
AFTER INSERT OR UPDATE ON ledger_transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION assert_ledger_transaction_balanced();
--> statement-breakpoint


-- Seed versioned settings. Confirm legal terms before enabling live payments.
INSERT INTO system_settings(setting_key, version, value, effective_from, change_reason)
VALUES
 ('topup_rate', 1, '{"amountVnd":100000,"points":1000}'::jsonb, now(), 'Initial configurable assumption; legal/commercial approval required'),
 ('platform_fee', 1, '{"feeBps":1000}'::jsonb, now(), 'Initial platform fee assumption: 10%'),
 ('seller_hold_period', 1, '{"days":7}'::jsonb, now(), 'Initial seller earnings hold period assumption: 7 days'),
 ('withdrawal_policy', 1, '{"manualReview":true}'::jsonb, now(), 'Manual payout review for MVP');
