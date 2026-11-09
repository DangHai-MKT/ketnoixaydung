
-- Better Auth integration for the existing marketplace.
-- REVIEW ONLY: do not execute against the current database yet.
-- Existing users, password_hash, email_verified_at and marketplace
-- ledger/purchase tables are intentionally preserved.

BEGIN;

-- Keep the existing users table and UUID primary keys.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image text;

-- Login sessions.
CREATE TABLE public.session (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT session_token_unique UNIQUE (token)
);

CREATE INDEX session_user_id_idx
  ON public.session (user_id);

-- Authentication accounts.
-- Password credentials for new users are stored in account.password.
CREATE TABLE public.account (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_user_id_idx
  ON public.account (user_id);

-- Email verification and other verification tokens.
CREATE TABLE public.verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX verification_identifier_idx
  ON public.verification (identifier);

COMMIT;
