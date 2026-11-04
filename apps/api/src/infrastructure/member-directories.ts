import type { TenantRecord } from '@tenantry/db';
import { organizationMembers, type IdentityDirectory, type MemberDirectory } from '@tenantry/keycloak-admin';
import type { SecretStore } from '@tenantry/keycloak-admin/secrets';
import { perRealm } from './per-realm.js';

export interface MemberDirectories {
  forTenant(tenant: TenantRecord): Promise<MemberDirectory>;
}

// Standard tenants: their organization in the platform realm. Enterprise tenants: their own realm, with
// that realm's tenantry-backend secret from the secrets store (ADR-0023), one directory per realm.
export function createMemberDirectories(o: {
  directory: IdentityDirectory;
  secrets: SecretStore;
  realmMembers: (realm: string, secret: string) => MemberDirectory;
}): MemberDirectories {
  const realmOf = perRealm(o.secrets, o.realmMembers);
  return {
    async forTenant(tenant) {
      if (tenant.tier === 'standard') {
        if (!tenant.kcOrgId) throw new Error(`tenant ${tenant.slug} has no organization`);
        return organizationMembers(o.directory, tenant.kcOrgId);
      }
      return realmOf(tenant);
    },
  };
}
