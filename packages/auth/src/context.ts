import type { Permission, Role } from './roles.js';

// What every request becomes after the auth guard; nothing after it knows the tenant's tier.
export interface TenantContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly roles: readonly Role[];
  readonly permissions: ReadonlySet<Permission>;
}
