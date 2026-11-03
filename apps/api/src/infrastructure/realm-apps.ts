import type { TenantRecord } from '@tenantry/db';
import { DirectoryError, type RealmApps } from '@tenantry/keycloak-admin';
import type { SecretStore } from '@tenantry/keycloak-admin/secrets';
import { backendSecretKey } from './member-directories.js';

export interface RealmAppsFactory {
  forTenant(tenant: TenantRecord): Promise<RealmApps>;
}

// One RealmApps per enterprise realm, with that realm's tenantry-backend secret (ADR-0023).
export function createRealmAppsFactory(o: {
  secrets: SecretStore;
  realmApps: (realm: string, secret: string) => RealmApps;
}): RealmAppsFactory {
  const realms = new Map<string, RealmApps>();
  return {
    async forTenant(tenant) {
      if (tenant.tier !== 'enterprise' || !tenant.realm) {
        throw new Error(`tenant ${tenant.slug} has no realm of its own`);
      }
      const cached = realms.get(tenant.realm);
      if (cached) return cached;
      const secret = await o.secrets.get(backendSecretKey(tenant.realm));
      if (!secret) throw new DirectoryError('backendSecret', 0, `no stored secret for ${tenant.realm}`);
      const apps = o.realmApps(tenant.realm, secret);
      realms.set(tenant.realm, apps);
      return apps;
    },
  };
}
