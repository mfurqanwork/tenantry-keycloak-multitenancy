import type { Permission, Role } from './roles.js';

// The two browser apps of a tenant: web at <slug>.<base>, portal at <slug>.portal.<base>.
export type TenantApp = 'web' | 'portal';

// What every request becomes after the auth guard; nothing after it knows the tenant's tier.
export interface TenantContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly roles: readonly Role[];
  readonly permissions: ReadonlySet<Permission>;
}
