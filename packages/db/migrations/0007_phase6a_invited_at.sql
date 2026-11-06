-- Phase 6a: open_invites_for_email also says when the invite was sent, so "Mark all as read" counts it as
-- read like any other notification (ADR-0028). Still no ids, emails or who invited.
DROP FUNCTION open_invites_for_email(text);
--> statement-breakpoint
CREATE FUNCTION open_invites_for_email(p_email text)
RETURNS TABLE (slug text, name text, role text, invited_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.slug, t.name, i.role, i.created_at
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
