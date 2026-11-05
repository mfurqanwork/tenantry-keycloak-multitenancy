import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { consoleSignIn, signInWithBrowser } from './helpers/browser-flow.js';
import { BASE_DOMAIN, env, HTTP_PORT, KEYCLOAK_URL } from './helpers/env.js';
import { api, tenantHost } from './helpers/http.js';
import { adminGet, createUser, deleteUser, grantClientRole, type TestUser } from './helpers/keycloak.js';
import { signupTenant, type TestTenant } from './helpers/tenants.js';

// Phase 5b: a Standard workspace moved into its own realm (ADR-0025), and console access (ADR-0026).
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const INITECH = { slug: 'initech', realm: 'ent-initech', owner: 'owner@initech.test' };
const port = HTTP_PORT === 80 ? '' : `:${String(HTTP_PORT)}`;
const webRedirect = (slug: string) => `http://${slug}.${BASE_DOMAIN}${port}/`;

function ops(...args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync('pnpm', ['--filter', '@tenantry/ops', '--silent', 'run', 'ops', ...args], {
      cwd: ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

const me = (host: string, token: string) =>
  api<{ user: { id: string }; role: string | null }>(host, 'GET', '/api/me', { token });

describe('guarantee: a Standard workspace moved to its own realm (Phase 5b)', () => {
  let ws: TestTenant;
  let stranger: TestUser;
  let userIdBefore: string;
  const realm = () => `ent-${ws.slug}`;
  const bridgeSignIn = (user: TestUser) =>
    signInWithBrowser({
      realm: realm(),
      clientId: 'tenantry-web',
      redirectUri: webRedirect(ws.slug),
      username: user.username,
      password: user.password,
      via: 'tenantry-account',
    });

  beforeAll(async () => {
    ws = await signupTenant('move');
    stranger = await createUser('stranger');
    userIdBefore = (await me(tenantHost(ws.slug), ws.ownerToken)).body.user.id;
    const moved = ops('enterprise', 'migrate', '--tenant', ws.slug);
    if (moved.code !== 0) throw new Error(`migrate ${ws.slug}: ${moved.out}`);
  });

  it('lets the owner in through the bridge with their old password, as the same person with the same role', async () => {
    const token = await bridgeSignIn(ws.owner);
    const res = await me(tenantHost(ws.slug), token);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userIdBefore);
    expect(res.body.role).toBe('owner');
  });

  it('refuses a stranger with a shared-realm account at the bridge, and makes them no account', async () => {
    await expect(bridgeSignIn(stranger)).rejects.toThrow(/did not finish/);
    const found = await adminGet(
      `/users?username=${encodeURIComponent(stranger.username)}&exact=true`,
      realm(),
    );
    expect(found.body).toEqual([]);
  });

  it("no longer takes the shared realm's token for the moved workspace", async () => {
    expect((await me(tenantHost(ws.slug), ws.ownerToken)).status).toBe(401);
  });

  it('finish removes the bridge', async () => {
    const done = ops('enterprise', 'migrate', '--tenant', ws.slug, '--finish');
    expect(done.code, done.out).toBe(0);
    expect((await adminGet(`/identity-provider/instances/tenantry-account`, realm())).status).toBe(404);
  });
});

describe('guarantee: console access is people and groups only (Phase 5b)', () => {
  let owner: string;
  let admin: TestUser;
  let adminUserId: string;
  let member: TestUser;
  let console_: string;
  let initechOwnerId: string;
  const made: string[] = [];
  const asConsole = async (method: string, path: string, body?: unknown, realm = INITECH.realm) =>
    (
      await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}${path}`, {
        method,
        headers: { authorization: `Bearer ${console_}`, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    ).status;
  const signIn = (username: string, password: string) =>
    signInWithBrowser({
      realm: INITECH.realm,
      clientId: 'tenantry-web',
      redirectUri: webRedirect(INITECH.slug),
      username,
      password,
    });

  beforeAll(async () => {
    owner = await signIn(INITECH.owner, env('SEED_PASSWORD'));
    admin = await createUser('console-admin', { realm: INITECH.realm });
    member = await createUser('console-member', { realm: INITECH.realm });
    made.push(admin.kcUserId, member.kcUserId);
    await grantClientRole(INITECH.realm, admin.kcUserId, 'tenantry-api', 'admin');
    await grantClientRole(INITECH.realm, member.kcUserId, 'tenantry-api', 'member');
    adminUserId = (await me(tenantHost(INITECH.slug), await signIn(admin.username, admin.password))).body.user
      .id;
    const granted = await api(tenantHost(INITECH.slug), 'POST', `/api/members/${adminUserId}/console`, {
      token: owner,
    });
    if (granted.status !== 204)
      throw new Error(`grant: ${String(granted.status)} ${JSON.stringify(granted.body)}`);
    console_ = await consoleSignIn({
      realm: INITECH.realm,
      username: admin.username,
      password: admin.password,
    });
    const [found] = (
      await adminGet(`/users?username=${encodeURIComponent(INITECH.owner)}&exact=true`, INITECH.realm)
    ).body as { id: string }[];
    initechOwnerId = found?.id ?? '';
  });

  afterAll(async () => {
    await api(tenantHost(INITECH.slug), 'DELETE', `/api/members/${adminUserId}/console`, { token: owner });
    for (const id of made) await deleteUser(INITECH.realm, id).catch(() => undefined);
  });

  it('lets a console user edit a member', async () => {
    expect(await asConsole('PUT', `/users/${member.kcUserId}`, { firstName: 'Edited' })).toBe(204);
  });

  it('does not let them edit or reset an owner', async () => {
    expect(await asConsole('PUT', `/users/${initechOwnerId}`, { firstName: 'Taken' })).toBe(403);
    expect(
      await asConsole('PUT', `/users/${initechOwnerId}/reset-password`, {
        type: 'password',
        value: 'Taken-over-1234',
        temporary: false,
      }),
    ).toBe(403);
  });

  it('does not let them hand out console access, or reach clients or the realm', async () => {
    const groups = (await adminGet(`/groups?search=tenantry-console&exact=true`, INITECH.realm)).body as {
      id: string;
      name: string;
    }[];
    const group = groups.find((g) => g.name === 'tenantry-console')?.id ?? '';
    expect(await asConsole('PUT', `/users/${member.kcUserId}/groups/${group}`)).toBe(403);
    expect(await asConsole('GET', '/clients')).toBe(403);
    expect(await asConsole('PUT', '', { displayName: 'Taken' })).toBe(403);
  });

  it("sees nothing of another workspace's realm", async () => {
    expect([401, 403, 404]).toContain(await asConsole('GET', '/users', undefined, 'platform'));
  });
});
