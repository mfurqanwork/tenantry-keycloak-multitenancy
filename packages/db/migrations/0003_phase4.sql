-- Phase 4: customer applications of enterprise tenants (ADR-0011). Keycloak holds the client and its
-- secret; this row is our record of it. Never a secret here.
CREATE TABLE tenant_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid
    REFERENCES tenants (id) ON DELETE CASCADE,
  client_id text NOT NULL,
  kc_client_uuid text NOT NULL,
  name text NOT NULL CONSTRAINT tenant_apps_name CHECK (char_length(name) BETWEEN 1 AND 80),
  type text NOT NULL CONSTRAINT tenant_apps_type CHECK (type IN ('web', 'spa', 'native', 'm2m')),
  redirect_uris text[] NOT NULL DEFAULT '{}',
  post_logout_redirect_uris text[] NOT NULL DEFAULT '{}',
  web_origins text[] NOT NULL DEFAULT '{}',
  -- Null when an operator registered the app (pnpm ops apps register).
  created_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tenant_apps_client_id UNIQUE (tenant_id, client_id)
);
--> statement-breakpoint
ALTER TABLE tenant_apps ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenant_apps FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON tenant_apps FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
