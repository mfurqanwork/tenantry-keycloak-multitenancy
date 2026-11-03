import type { TenantRecord } from '@tenantry/db';
import {
  DirectoryError,
  organizationMembers,
  type IdentityDirectory,
  type MemberDirectory,
} from '@tenantry/keycloak-admin';
import type { SecretStore } from '@tenantry/keycloak-admin/secrets';

export interface MemberDirectories {
  forTenant(tenant: TenantRecord): Promise<MemberDirectory>;
}

export const backendSecretKey = (realm: string) => `${realm}/tenantry-backend`;

// Standard tenants: their organization in the platform realm. Enterprise tenants: their own realm, with
// that realm's tenantry-backend secret from the secrets store (ADR-0023), one directory per realm.
export function createMemberDirectories(o: {
  directory: IdentityDirectory;
  secrets: SecretStore;
  realmMembers: (realm: string, secret: string) => MemberDirectory;
}): MemberDirectories {
  const realms = new Map<string, MemberDirectory>();
  return {
    async forTenant(tenant) {
      if (tenant.tier === 'standard') {
        if (!tenant.kcOrgId) throw new Error(`tenant ${tenant.slug} has no organization`);
        return organizationMembers(o.directory, tenant.kcOrgId);
      }
      if (!tenant.realm) throw new Error(`tenant ${tenant.slug} has no realm`);
      const cached = realms.get(tenant.realm);
      if (cached) return cached;
      const secret = await o.secrets.get(backendSecretKey(tenant.realm));
      if (!secret) throw new DirectoryError('backendSecret', 0, `no stored secret for ${tenant.realm}`);
      const members = o.realmMembers(tenant.realm, secret);
      realms.set(tenant.realm, members);
      return members;
    },
  };
}
