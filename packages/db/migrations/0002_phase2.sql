-- Phase 2: tenant logos, company domains and their identity providers. Each is a tenant table (ADR-0006).
CREATE TABLE tenant_logos (
  tenant_id uuid PRIMARY KEY DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid
    REFERENCES tenants (id) ON DELETE CASCADE,
  content_type text NOT NULL
    CONSTRAINT tenant_logos_type CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
  bytes bytea NOT NULL CONSTRAINT tenant_logos_size CHECK (octet_length(bytes) <= 262144),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
--> statement-breakpoint
CREATE TABLE tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid
    REFERENCES tenants (id) ON DELETE CASCADE,
  domain text NOT NULL CONSTRAINT tenant_domains_lowercase CHECK (domain = lower(domain)),
  verification_token text NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_domains_once UNIQUE (tenant_id, domain)
);
--> statement-breakpoint
-- Any tenant may claim a domain; only one may prove it. A unique index sees the rows of every tenant.
CREATE UNIQUE INDEX tenant_domains_verified ON tenant_domains (domain) WHERE verified_at IS NOT NULL;
--> statement-breakpoint
CREATE TABLE tenant_idps (
  tenant_id uuid NOT NULL DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid
    REFERENCES tenants (id) ON DELETE CASCADE,
  alias text NOT NULL CONSTRAINT tenant_idps_alias UNIQUE,
  domain_id uuid NOT NULL REFERENCES tenant_domains (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, alias)
);
--> statement-breakpoint
ALTER TABLE tenant_logos ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenant_logos FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON tenant_logos FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenant_domains FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON tenant_domains FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE tenant_idps ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenant_idps FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON tenant_idps FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
