import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRealmConsole } from '../src/realms/console.js';
import { createRealmMembers } from '../src/realms/realm-members.js';
import { runRealmConsoleContract } from '../src/testing/console-contract.js';
import { baseUrl, bootstrap, consoleSignIn, env, provisionTestRealm, testProvisioner } from './stack.js';

const publicAuthUrl = new URL(env('TENANTRY_AUTH_URL')).origin;
const consoleFor = (realm: string) =>
  createRealmConsole({
    baseUrl,
    publicAuthUrl,
    realm,
    provisionerClientId: env('KEYCLOAK_PROVISIONER_CLIENT_ID'),
    provisionerClientSecret: env('KEYCLOAK_PROVISIONER_CLIENT_SECRET'),
  });

async function makeRealm(prefix: string) {
  const { realm, secret } = await provisionTestRealm(prefix, 'Console');
  await testProvisioner().ensureGroups(realm);
  const get = async <T>(path: string) => (await (await bootstrap('GET', `/${realm}${path}`)).json()) as T;
  const PW = `Pw-${randomBytes(9).toString('base64url')}`;
  const createUser = async (): Promise<string> => {
    const username = `u${randomBytes(4).toString('hex')}`;
    const res = await bootstrap('POST', `/${realm}/users`, {
      username,
      email: `${username}@console.test`,
      emailVerified: true,
      enabled: true,
      firstName: 'Con',
      lastName: 'Sole',
      credentials: [{ type: 'password', value: PW, temporary: false }],
    });
    return res.headers.get('location')?.split('/').pop() ?? '';
  };
  const usernameOf = async (id: string) => (await get<{ username: string }>(`/users/${id}`)).username;
  return { realm, secret, get, PW, createUser, usernameOf };
}

runRealmConsoleContract('Keycloak realm', async () => {
  const r = await makeRealm('cc');
  return {
    console: consoleFor(r.realm),
    realm: r.realm,
    createUser: r.createUser,
    async hasConsole(id) {
      const groups = await r.get<{ name: string }[]>(`/users/${id}/groups`);
      return groups.some((g) => g.name === 'tenantry-console');
    },
    async protectedOwners() {
      const [ap] = await r.get<{ id: string }[]>('/clients?clientId=admin-permissions');
      const rs = `/clients/${ap?.id ?? ''}/authz/resource-server`;
      const list = await r.get<{ id: string; name: string }[]>(
        `${rs}/permission?name=${encodeURIComponent('console users: not owners')}&first=0&max=50`,
      );
      const perm = list.find((p) => p.name === 'console users: not owners');
      if (!perm) return [];
      const resources = await r.get<{ name: string }[]>(`${rs}/policy/${perm.id}/resources`);
      return resources.map((x) => x.name);
    },
    async cleanup() {
      await bootstrap('DELETE', `/${r.realm}`);
    },
  };
});

describe('what a console user may do (Keycloak)', () => {
  let r: Awaited<ReturnType<typeof makeRealm>>;
  let token: string;
  let owner: string;
  let member: string;
  const as = async (method: string, path: string, body?: unknown, realm = r.realm) =>
    (
      await fetch(`${baseUrl}/admin/realms/${realm}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    ).status;
  const groupId = async (name: string) =>
    (await r.get<{ id: string; name: string }[]>(`/groups?search=${name}&exact=true`)).find(
      (g) => g.name === name,
    )?.id ?? '';

  beforeAll(async () => {
    r = await makeRealm('cp');
    const c = consoleFor(r.realm);
    await c.ensurePermissions();
    const it = await r.createUser();
    owner = await r.createUser();
    member = await r.createUser();
    await c.grant(it);
    await c.protectOwners([owner]);
    token = await consoleSignIn({ realm: r.realm, username: await r.usernameOf(it), password: r.PW });
  });
  afterAll(async () => {
    await bootstrap('DELETE', `/${r.realm}`);
  });

  it('the console starts: whoami answers', async () => {
    const res = await fetch(`${baseUrl}/admin/${r.realm}/console/whoami?currentRealm=${r.realm}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('may edit and reset a member, and add them to tenantry-admins', async () => {
    expect(await as('PUT', `/users/${member}`, { firstName: 'Edited' })).toBe(204);
    expect(
      await as('PUT', `/users/${member}/reset-password`, {
        type: 'password',
        value: `Re-${randomBytes(9).toString('base64url')}`,
        temporary: true,
      }),
    ).toBe(204);
    expect(await as('PUT', `/users/${member}/groups/${await groupId('tenantry-admins')}`)).toBe(204);
  });

  it('may view an owner, but not edit, reset or delete them', async () => {
    expect(await as('GET', `/users/${owner}`)).toBe(200);
    expect(await as('PUT', `/users/${owner}`, { firstName: 'Taken' })).toBe(403);
    expect(
      await as('PUT', `/users/${owner}/reset-password`, {
        type: 'password',
        value: 'Xx-123456789!',
        temporary: false,
      }),
    ).toBe(403);
    expect(await as('DELETE', `/users/${owner}`)).toBe(403);
  });

  it('may not hand out console access, map roles, impersonate, or open clients, the realm or identity providers', async () => {
    expect(await as('PUT', `/users/${member}/groups/${await groupId('tenantry-console')}`)).toBe(403);
    const [rm] = await r.get<{ id: string }[]>('/clients?clientId=realm-management');
    const roles = await r.get<unknown[]>(`/clients/${rm?.id ?? ''}/roles`);
    expect(
      await as('POST', `/users/${member}/role-mappings/clients/${rm?.id ?? ''}`, roles.slice(0, 1)),
    ).toBe(403);
    expect(await as('POST', `/users/${member}/impersonation`)).toBe(403);
    expect(await as('GET', '/clients')).toBe(403);
    expect(await as('PUT', '', { displayName: 'Taken' })).toBe(403);
    expect(await as('GET', '/identity-provider/instances')).toBe(403);
  });

  it("Tenantry's backend still changes the role of someone with console access, and removes them", async () => {
    const members = createRealmMembers({ baseUrl, realm: r.realm, clientSecret: r.secret });
    const { kcUserId } = await members.invite(`c${randomBytes(3).toString('hex')}@console.test`, 'admin');
    const id = kcUserId ?? '';
    await consoleFor(r.realm).grant(id);
    await expect(members.setRole(id, 'member')).resolves.toBeUndefined();
    await expect(members.remove(id)).resolves.toBeUndefined();
  });

  it('cannot see another realm', async () => {
    expect([401, 403, 404]).toContain(await as('GET', '/users', undefined, 'platform'));
  });
});
