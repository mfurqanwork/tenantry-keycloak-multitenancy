-- Phase 6a: notifications (ADR-0028). Notifications are read from the audit log; this table only keeps how
-- far each person has read, per workspace.
CREATE TABLE notification_reads (
  tenant_id uuid NOT NULL DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid
    REFERENCES tenants (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  read_until timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
);
--> statement-breakpoint
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE notification_reads FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON notification_reads FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- Forced row-level security binds the table owner too, so the function below (which runs as the owner)
-- needs its own read-only policy. The app role never runs as the owner; only migrations and that function do.
CREATE POLICY owner_reads_open_invites ON tenant_invites FOR SELECT TO tenantry_owner USING (true);
--> statement-breakpoint
-- The one read across workspaces outside the platform tables (ADR-0028): which active workspaces hold an
-- open invite to exactly this email. It returns only the workspace's slug and name and the role; the API
-- calls it only with the verified email from the person's own token.
CREATE FUNCTION open_invites_for_email(p_email text)
RETURNS TABLE (slug text, name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.slug, t.name, i.role
  FROM tenant_invites i
  JOIN tenants t ON t.id = i.tenant_id
  WHERE lower(i.email) = lower(p_email)
    AND i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND t.status = 'active'
  ORDER BY i.created_at DESC
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION open_invites_for_email(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION open_invites_for_email(text) TO tenantry_app;
