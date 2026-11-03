import { platformRepository, type TenantRecord } from '@tenantry/db';
import type { OpsDeps } from '../deps.js';

// The active workspace an operator names, or null after saying why.
export async function activeWorkspace(deps: OpsDeps, slug: string): Promise<TenantRecord | null> {
  const tenant = await platformRepository(deps.db).findTenantBySlug(slug.toLowerCase());
  if (tenant?.status !== 'active' || !tenant.kcOrgId) {
    deps.err(`No active workspace ${slug}.`);
    return null;
  }
  return tenant;
}

// Operator changes have no signed-in user; the audit entry says they came from the scripts.
export const OPS = { actorUserId: null, metadata: { via: 'ops' } } as const;
