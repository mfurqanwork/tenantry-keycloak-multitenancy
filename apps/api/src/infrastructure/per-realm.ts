import type { TenantRecord } from '@tenantry/db';
import { DirectoryError } from '@tenantry/keycloak-admin';
import type { SecretStore } from '@tenantry/keycloak-admin/secrets';

export const backendSecretKey = (realm: string) => `${realm}/tenantry-backend`;

// One client per enterprise realm, made with that realm's tenantry-backend secret from the secrets
// store (ADR-0023) and kept for later requests.
export function perRealm<T>(
  secrets: SecretStore,
  make: (realm: string, secret: string) => T,
): (tenant: TenantRecord) => Promise<T> {
  const made = new Map<string, T>();
  return async (tenant) => {
    if (tenant.tier !== 'enterprise' || !tenant.realm) {
      throw new Error(`tenant ${tenant.slug} has no realm of its own`);
    }
    const cached = made.get(tenant.realm);
    if (cached) return cached;
    const secret = await secrets.get(backendSecretKey(tenant.realm));
    if (!secret) throw new DirectoryError('backendSecret', 0, `no stored secret for ${tenant.realm}`);
    const client = make(tenant.realm, secret);
    made.set(tenant.realm, client);
    return client;
  };
}
