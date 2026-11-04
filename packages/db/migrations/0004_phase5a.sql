-- Phase 5a: SCIM tokens (ADR-0024) and each enterprise realm's sign-in rules. Tenant tables (ADR-0006).
-- A SCIM token is stored only as its SHA-256 hash; the token itself is shown once and never kept.
CREATE TABLE tenant_scim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid
    REFERENCES tenants (id) ON DELETE CASCADE,
  token_hash bytea NOT NULL CONSTRAINT tenant_scim_tokens_hash UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
--> statement-breakpoint
-- One active token per tenant.
CREATE UNIQUE INDEX tenant_scim_tokens_one_active ON tenant_scim_tokens (tenant_id) WHERE revoked_at IS NULL;
--> statement-breakpoint
CREATE TABLE tenant_security (
  tenant_id uuid PRIMARY KEY DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid
    REFERENCES tenants (id) ON DELETE CASCADE,
  two_step text NOT NULL CONSTRAINT tenant_security_two_step CHECK (two_step IN ('off', 'optional', 'required')),
  password_min_length integer NOT NULL
    CONSTRAINT tenant_security_password_min_length CHECK (password_min_length BETWEEN 12 AND 64),
  password_history integer NOT NULL
    CONSTRAINT tenant_security_password_history CHECK (password_history BETWEEN 0 AND 24),
  password_expiry_days integer NOT NULL
    CONSTRAINT tenant_security_password_expiry CHECK (password_expiry_days BETWEEN 0 AND 365),
  session_idle_minutes integer NOT NULL
    CONSTRAINT tenant_security_session_idle CHECK (session_idle_minutes BETWEEN 15 AND 720),
  session_max_hours integer NOT NULL
    CONSTRAINT tenant_security_session_max CHECK (session_max_hours BETWEEN 1 AND 24),
  lockout_failures integer NOT NULL
    CONSTRAINT tenant_security_lockout_failures CHECK (lockout_failures BETWEEN 3 AND 20),
  lockout_wait_minutes integer NOT NULL
    CONSTRAINT tenant_security_lockout_wait CHECK (lockout_wait_minutes BETWEEN 1 AND 60),
  scim_default_role text NOT NULL
    CONSTRAINT tenant_security_scim_role CHECK (scim_default_role IN ('member', 'none')),
  updated_by uuid REFERENCES users (id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tenant_security_idle_within_max CHECK (session_idle_minutes <= session_max_hours * 60)
);
--> statement-breakpoint
ALTER TABLE tenant_scim_tokens ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenant_scim_tokens FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON tenant_scim_tokens FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE tenant_security ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenant_security FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON tenant_security FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
