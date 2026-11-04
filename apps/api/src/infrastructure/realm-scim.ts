import type { TenantRecord } from '@tenantry/db';
import type { RealmScim } from '@tenantry/keycloak-admin';

export interface RealmScimFactory {
  forTenant(tenant: TenantRecord): RealmScim;
}

// The native SCIM of each enterprise realm, behind the gateway (ADR-0024); one per realm, kept.
export function createRealmScimFactory(
  make: (realm: string, publicIssuer: string) => RealmScim,
): RealmScimFactory {
  const made = new Map<string, RealmScim>();
  return {
    forTenant(tenant) {
      if (tenant.tier !== 'enterprise' || !tenant.realm || !tenant.issuer) {
        throw new Error(`tenant ${tenant.slug} has no realm of its own`);
      }
      let scim = made.get(tenant.realm);
      if (!scim) {
        scim = make(tenant.realm, tenant.issuer);
        made.set(tenant.realm, scim);
      }
      return scim;
    },
  };
}
