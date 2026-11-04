import { getMigration, listAudit, platformRepository, tenantTx } from '@tenantry/db';
import { BRIDGE_ALIAS, idpSecretKey } from '@tenantry/keycloak-admin';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant, type TestUser } from '../../testing/test-app.js';

interface Plan {
  slug: string;
  realm: string;
  members: { email: string | null; role: string | null }[];
  invites: number;
  companyLogins: { alias: string; secretKept: boolean }[];
}
interface Result extends Plan {
  cutOver: boolean;
  waitingForSecret: string[];
}

let t: TestApp;
let operator: string;
let ws: TestTenant;
let owner: { user: TestUser; token: string };

const appPromise = createTestApp();
afterAll(async () => (await appPromise).close());

const op = <T>(path: string, body: unknown, method = 'POST') =>
  t.request<T & { detail?: string }>({ host: t.apexHost, method, path, token: operator, body });
const migrate = (dryRun = false, slug = ws.slug) =>
  op<Result>('/api/platform/enterprise-tenants/migrate', { slug, dryRun });
const finish = (slug = ws.slug) => op<unknown>('/api/platform/enterprise-tenants/migrate/finish', { slug });
const abort = (slug = ws.slug) => op<unknown>('/api/platform/enterprise-tenants/migrate/abort', { slug });
const realm = () => `ent-${ws.slug}`;
const issuer = () => `${t.issuer.baseUrl}/realms/${realm()}`;
const tenant = async () => platformRepository(t.db).findTenantBySlug(ws.slug);
// The moved person's account in the new realm, and a token from it.
const moved = (email: string) =>
  [...t.realmMembers(realm()).users].find(([, u]) => u.email === email.toLowerCase());
const realmToken = async (email: string, role: string) => {
  const [kcUserId] = moved(email) ?? [''];
  return t.enterpriseToken({ issuer: issuer() }, { sub: kcUserId, email }, [role]);
};
// Company-login aliases and domains are unique across workspaces, and the test database persists.
const unique = (name: string) => `${name}-${randomUUID().slice(0, 6)}`;
const audit = async () => tenantTx(t.db, ws.id, (tx) => listAudit(tx, { limit: 50 }));

beforeEach(async () => {
  t = await appPromise;
  operator = await t.operatorToken();
  ws = await t.seedTenant();
  owner = await t.member(ws, 'owners');
});

describe('moving a Standard workspace to Enterprise', () => {
  it('the dry run lists people, roles, invites and company logins, and changes nothing', async () => {
    const admin = await t.member(ws, 'admins');
    await t.request({
      host: ws.host,
      method: 'POST',
      path: '/api/members/invites',
      token: owner.token,
      body: { email: 'later@example.com', role: 'member' },
    });
    const res = await migrate(true);
    expect(res.status).toBe(200);
    expect(res.body.realm).toBe(realm());
    expect(res.body.members.map((m) => [m.email, m.role]).sort()).toEqual(
      [
        [owner.user.email, 'owner'],
        [admin.user.email, 'admin'],
      ].sort(),
    );
    expect(res.body.invites).toBe(1);
    expect(t.provisioner.realms.has(realm())).toBe(false);
    expect((await tenant())?.status).toBe('active');
  });

  it('moves a workspace: same users.id through a new identity, same role, projects still there', async () => {
    const before = await t.request<{ user: { id: string } }>({
      host: ws.host,
      path: '/api/me',
      token: owner.token,
    });
    await t.request({
      host: ws.host,
      method: 'POST',
      path: '/api/projects',
      token: owner.token,
      body: { name: 'Kept' },
    });
    const res = await migrate();
    expect(res.status).toBe(200);
    expect(res.body.cutOver).toBe(true);
    expect(await tenant()).toMatchObject({
      tier: 'enterprise',
      status: 'active',
      realm: realm(),
      issuer: issuer(),
      kcOrgId: null,
    });
    expect(moved(owner.user.email)?.[1].role).toBe('owner');
    // The shared-realm token no longer works here; the realm's does, as the same person.
    expect((await t.request({ host: ws.host, path: '/api/me', token: owner.token })).status).toBe(401);
    const token = await realmToken(owner.user.email, 'owner');
    const after = await t.request<{ user: { id: string } }>({ host: ws.host, path: '/api/me', token });
    expect(after.status).toBe(200);
    expect(after.body.user.id).toBe(before.body.user.id);
    const projects = await t.request<{ projects: { name: string }[] }>({
      host: ws.host,
      path: '/api/projects',
      token,
    });
    expect(projects.body.projects.map((p) => p.name)).toContain('Kept');
    // Pre-linked to the bridge with their shared-realm account, which keeps its own identity.
    const [kcUserId] = moved(owner.user.email) ?? [''];
    expect(t.realmIdps(realm()).links.get(kcUserId)?.get(BRIDGE_ALIAS)).toBe(owner.user.sub);
    expect(t.realmBridge(realm()).present).toBe(true);
    expect(t.directory.bridgeClients.has(ws.slug)).toBe(true);
    const entry = (await audit()).find((e) => e.action === 'tenant.migrated');
    expect(entry?.metadata).toMatchObject({ people: 1, invites: 0, companyLogins: 0 });
    expect(t.realmConsole(realm()).owners).toEqual([kcUserId]);
  });

  it('keeps the shared-realm identity for other workspaces', async () => {
    const other = await t.seedTenant();
    await t.join(other, owner.user, 'members');
    await migrate();
    const there = await t.token(owner.user, { alias: other.slug, groups: ['/members'] });
    expect((await t.request({ host: other.host, path: '/api/me', token: there })).status).toBe(200);
  });

  it('moves a member with no role', async () => {
    const quiet = t.newUser();
    await t.join(ws, quiet, null);
    t.directory.federated.set(quiet.sub, [{ alias: 'gone-login', userId: 'corp-1', userName: 'quiet' }]);
    await migrate();
    const found = moved(quiet.email);
    expect(found?.[1].role).toBeNull();
    expect(
      t
        .realmIdps(realm())
        .links.get(found?.[0] ?? '')
        ?.get(BRIDGE_ALIAS),
    ).toBe(quiet.sub);
  });

  it('rerun after a failure part-way through people', async () => {
    await t.member(ws, 'members');
    await t.member(ws, 'admins');
    const members = t.realmMembers(realm());
    let calls = 0;
    const real = members.importMember.bind(members);
    members.importMember = (input) => {
      calls++;
      return calls === 2 ? Promise.reject(new Error('Keycloak went away')) : real(input);
    };
    expect((await migrate()).status).toBeGreaterThanOrEqual(500);
    members.importMember = real;
    expect((await tenant())?.status).toBe('migrating');
    const res = await migrate();
    expect(res.body.cutOver).toBe(true);
    expect(members.users.size).toBe(3);
    const ids = await tenantTx(t.db, ws.id, async () =>
      platformRepository(t.db).userIdsForSubjects(issuer(), [...members.users.keys()]),
    );
    expect(ids.size).toBe(3);
  });

  it('freezes people changes while moving', async () => {
    const members = t.realmMembers(realm());
    const real = members.importMember.bind(members);
    members.importMember = () => Promise.reject(new Error('stop here'));
    await migrate();
    members.importMember = real;
    const write = await t.request<{ detail: string }>({
      host: ws.host,
      method: 'POST',
      path: '/api/members/invites',
      token: owner.token,
      body: { email: 'blocked@example.com', role: 'member' },
    });
    expect(write.status).toBe(409);
    expect(write.body.detail).toBe('This workspace is moving to Enterprise. Try again in a few minutes.');
    const colour = await t.request({
      host: ws.host,
      method: 'PUT',
      path: '/api/branding',
      token: owner.token,
      body: { primaryColor: '#0f62fe' },
    });
    expect(colour.status).toBe(409);
    expect((await t.request({ host: ws.host, path: '/api/members', token: owner.token })).status).toBe(200);
    expect((await t.request({ host: ws.host, path: '/api/projects', token: owner.token })).status).toBe(200);
  });

  it('copies a company login with its kept secret enabled, and one without disabled, naming it', async () => {
    const kept = unique('kept');
    const old = unique('old');
    await t.linkCompanyLogin(ws, kept, `${kept}.test`);
    await t.linkCompanyLogin(ws, old, `${old}.test`);
    await t.secrets.put(idpSecretKey(kept), 'kept-secret');
    const dry = await migrate(true);
    expect(dry.body.companyLogins.sort((a, b) => a.alias.localeCompare(b.alias))).toEqual([
      { alias: kept, secretKept: true },
      { alias: old, secretKept: false },
    ]);
    const res = await migrate();
    expect(res.body.waitingForSecret).toEqual([old]);
    expect(t.realmIdps(realm()).providers.get(kept)).toMatchObject({
      enabled: true,
      secret: 'kept-secret',
    });
    expect(t.realmIdps(realm()).providers.get(old)?.enabled).toBe(false);
  });

  it('idp secret route sets it, keeps it, enables it, audits idp.secret_set without the secret', async () => {
    const alias = unique('late');
    await t.linkCompanyLogin(ws, alias, `${alias}.test`);
    await migrate();
    const res = await op(
      '/api/platform/enterprise-tenants/' + ws.slug + `/idps/${alias}/secret`,
      { secret: 'late-secret' },
      'PUT',
    );
    expect(res.status).toBe(204);
    expect(await t.secrets.get(idpSecretKey(alias))).toBe('late-secret');
    expect(t.realmIdps(realm()).providers.get(alias)).toMatchObject({
      enabled: true,
      secret: 'late-secret',
    });
    const entries = await audit();
    expect(entries.find((e) => e.action === 'idp.secret_set')?.metadata).toMatchObject({ alias });
    expect(JSON.stringify(entries)).not.toContain('late-secret');
  });

  it('abort before the cut-over puts everything back; abort after the cut-over is 409', async () => {
    const members = t.realmMembers(realm());
    const real = members.importMember.bind(members);
    members.importMember = () => Promise.reject(new Error('stop here'));
    await migrate();
    members.importMember = real;
    expect((await abort()).status).toBe(204);
    expect(await tenant()).toMatchObject({ tier: 'standard', status: 'active', kcOrgId: ws.kcOrgId });
    expect(t.provisioner.realms.has(realm())).toBe(false);
    expect(t.directory.bridgeClients.has(ws.slug)).toBe(false);
    expect((await t.request({ host: ws.host, path: '/api/me', token: owner.token })).status).toBe(200);
    await migrate();
    const late = await abort();
    expect(late.status).toBe(409);
  });

  it('finish removes the bridge and the organization, and is idempotent', async () => {
    await migrate();
    expect((await finish()).status).toBe(204);
    expect((await finish()).status).toBe(204);
    expect(t.realmBridge(realm()).present).toBe(false);
    expect(t.directory.bridgeClients.has(ws.slug)).toBe(false);
    expect(t.directory.orgs.has(ws.kcOrgId)).toBe(false);
    expect((await tenantTx(t.db, ws.id, (tx) => getMigration(tx)))?.finishedAt).toBeInstanceOf(Date);
  });

  it('refuses an enterprise workspace, and a person', async () => {
    const ent = await t.seedEnterpriseTenant();
    const res = await migrate(false, ent.slug);
    expect(res.status).toBe(409);
    expect(res.body.detail).toBe('Already an enterprise workspace.');
    const person = await t.request({
      host: t.apexHost,
      method: 'POST',
      path: '/api/platform/enterprise-tenants/migrate',
      token: owner.token,
      body: { slug: ws.slug, dryRun: true },
    });
    expect([401, 403]).toContain(person.status);
  });
});
