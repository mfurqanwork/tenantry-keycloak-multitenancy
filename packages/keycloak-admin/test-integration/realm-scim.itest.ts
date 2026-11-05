import { createRealmScim } from '../src/realms/scim.js';
import { runRealmScimContract } from '../src/testing/scim-contract.js';
import { baseUrl, bootstrap, env, provisionTestRealm, testProvisioner } from './stack.js';

runRealmScimContract('Keycloak realm', async () => {
  const { realm } = await provisionTestRealm('sc', 'Scim Contract');
  await testProvisioner().ensureGroups(realm);
  const kept = new Map<string, string>();
  const scim = createRealmScim({
    baseUrl,
    publicIssuer: `${new URL(env('TENANTRY_AUTH_URL')).origin}/realms/${realm}`,
    realm,
    provisionerClientId: env('KEYCLOAK_PROVISIONER_CLIENT_ID'),
    provisionerClientSecret: env('KEYCLOAK_PROVISIONER_CLIENT_SECRET'),
    secrets: {
      get: (key) => Promise.resolve(kept.get(key) ?? null),
      put: (key, value) => {
        kept.set(key, value);
        return Promise.resolve();
      },
    },
  });
  const get = async <T>(path: string) => (await (await bootstrap('GET', `/${realm}${path}`)).json()) as T;
  const groupId = async (name: string) =>
    (await get<{ id: string; name: string }[]>(`/groups?search=${name}&exact=true`)).find(
      (g) => g.name === name,
    )?.id ?? '';
  // As provisioning does it (ADR-0026): the SCIM client is made, then admin permissions go on, and SCIM
  // is turned on later, by the first token.
  await scim.prepare();
  await bootstrap('PUT', `/${realm}`, { adminPermissionsEnabled: true });
  return {
    scim,
    async roleOf(kcUserId) {
      const [api] = await get<{ id: string }[]>('/clients?clientId=tenantry-api');
      const roles = await get<{ name: string }[]>(
        `/users/${kcUserId}/role-mappings/clients/${api?.id ?? ''}`,
      );
      return roles[0]?.name ?? null;
    },
    groupId,
    async addToGroup(kcUserId, name) {
      await bootstrap('PUT', `/${realm}/users/${kcUserId}/groups/${await groupId(name)}`);
    },
    async groupMembers(name) {
      return (await get<{ id: string }[]>(`/groups/${await groupId(name)}/members`)).map((m) => m.id);
    },
    async makeOwner(kcUserId) {
      const [api] = await get<{ id: string }[]>('/clients?clientId=tenantry-api');
      const owner = await get<unknown>(`/clients/${api?.id ?? ''}/roles/owner`);
      await bootstrap('POST', `/${realm}/users/${kcUserId}/role-mappings/clients/${api?.id ?? ''}`, [owner]);
    },
    async isEnabled(kcUserId) {
      return (await get<{ enabled: boolean }>(`/users/${kcUserId}`)).enabled;
    },
    async cleanup() {
      await bootstrap('DELETE', `/${realm}`);
    },
  };
});
