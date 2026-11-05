-- Phase 5b: moving a Standard workspace to Enterprise (ADR-0025), and console access (ADR-0026).
ALTER TABLE tenants DROP CONSTRAINT tenants_status;
--> statement-breakpoint
ALTER TABLE tenants ADD CONSTRAINT tenants_status CHECK (status IN ('provisioning', 'active', 'failed', 'migrating'));
--> statement-breakpoint
-- One move per tenant. Steps check this row and Keycloak's state, so a rerun finishes a move.
CREATE TABLE tenant_migrations (
  tenant_id uuid PRIMARY KEY DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid
    REFERENCES tenants (id) ON DELETE CASCADE,
  from_org_id text NOT NULL,
  realm text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  cut_over_at timestamptz,
  finished_at timestamptz,
  aborted_at timestamptz
);
--> statement-breakpoint
-- Who may open the realm's Keycloak console (people and groups only).
CREATE TABLE tenant_console_access (
  tenant_id uuid NOT NULL DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid
    REFERENCES tenants (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  granted_by uuid REFERENCES users (id),
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, user_id)
);
--> statement-breakpoint
ALTER TABLE tenant_migrations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenant_migrations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON tenant_migrations FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE tenant_console_access ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenant_console_access FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON tenant_console_access FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
