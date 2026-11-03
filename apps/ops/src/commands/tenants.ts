import { tenantOrigin } from '@tenantry/auth';
import { platformRepository } from '@tenantry/db';
import type { ExitCode, OpsDeps } from '../deps.js';

// Registers both app addresses of every active workspace with Keycloak, for workspaces created before
// the portal had its own client. Safe to run again.
export async function syncOrigins(deps: OpsDeps): Promise<ExitCode> {
  const tenants = await platformRepository(deps.db).listActiveTenants();
  for (const tenant of tenants) {
    await deps.directory.addTenantOrigin(tenantOrigin(tenant.slug, deps.origins, 'web'), 'web');
    await deps.directory.addTenantOrigin(tenantOrigin(tenant.slug, deps.origins, 'portal'), 'portal');
  }
  deps.out(`Registered the web and portal addresses of ${String(tenants.length)} workspaces.`);
  return 0;
}
