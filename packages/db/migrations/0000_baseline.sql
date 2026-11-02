-- Tables are owned by tenantry_owner; the app role only reads and writes rows (ADR-0006).
GRANT USAGE ON SCHEMA public TO tenantry_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE tenantry_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tenantry_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE tenantry_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tenantry_app;
