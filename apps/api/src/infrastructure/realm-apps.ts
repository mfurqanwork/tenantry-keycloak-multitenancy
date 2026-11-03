import type { TenantRecord } from '@tenantry/db';
import type { RealmApps } from '@tenantry/keycloak-admin';
import type { SecretStore } from '@tenantry/keycloak-admin/secrets';
import { perRealm } from './per-realm.js';

export interface RealmAppsFactory {
  forTenant(tenant: TenantRecord): Promise<RealmApps>;
}

// The customer apps of an enterprise tenant, in its own realm (ADR-0011).
export function createRealmAppsFactory(o: {
  secrets: SecretStore;
  realmApps: (realm: string, secret: string) => RealmApps;
}): RealmAppsFactory {
  return { forTenant: perRealm(o.secrets, o.realmApps) };
}
