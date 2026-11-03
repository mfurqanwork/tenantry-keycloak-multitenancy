import { randomUUID } from 'node:crypto';
import { createHttpIdentityDirectory } from '../src/http-identity-directory.js';
import { runIdentityDirectoryContract } from '../src/testing/contract.js';
import { adminToken, baseUrl, env } from './stack.js';

runIdentityDirectoryContract('Keycloak over HTTP', async () => {
  const token = await adminToken();
  const users = `${baseUrl}/admin/realms/platform/users`;
  const created: string[] = [];
  return {
    dir: createHttpIdentityDirectory({
      baseUrl,
      realm: 'platform',
      // The operator account: the only one that may manage identity providers (ADR-0022).
      clientId: env('KEYCLOAK_OPS_CLIENT_ID'),
      clientSecret: env('KEYCLOAK_OPS_CLIENT_SECRET'),
      webClientId: 'tenantry-web',
      portalClientId: 'tenantry-portal',
    }),
    async newUser() {
      const name = `contract-${randomUUID().slice(0, 8)}`;
      const res = await fetch(users, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ username: name, email: `${name}@example.com`, enabled: true }),
      });
      const id = res.headers.get('location')?.split('/').pop();
      if (res.status !== 201 || !id) throw new Error(`create user: ${res.status}`);
      created.push(id);
      return id;
    },
    async redirectUris(app) {
      const clientId = app === 'web' ? 'tenantry-web' : 'tenantry-portal';
      const res = await fetch(`${baseUrl}/admin/realms/platform/clients?clientId=${clientId}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const [found] = (await res.json()) as { redirectUris?: string[] }[];
      return found?.redirectUris ?? [];
    },
    companyIssuer: `${env('TENANTRY_AUTH_URL')}/realms/corp-demo`,
    async orgDomains(orgId) {
      const res = await fetch(`${baseUrl}/admin/realms/platform/organizations/${orgId}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const org = (await res.json()) as { domains?: { name: string; identityProviderAlias?: string }[] };
      return (org.domains ?? []).map((d) => ({
        name: d.name,
        identityProviderAlias: d.identityProviderAlias ?? null,
      }));
    },
    async cleanup() {
      for (const id of created) {
        await fetch(`${users}/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
      }
    },
  };
});
