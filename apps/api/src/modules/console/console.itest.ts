import { listAudit, listConsole, tenantTx } from '@tenantry/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant, type TestUser } from '../../testing/test-app.js';

type Ent = TestTenant & { issuer: string; realm: string };
interface Person {
  user: TestUser;
  token: string;
  userId: string;
}

let t: TestApp;
let ent: Ent;
let owner: Person;

const appPromise = createTestApp();
afterAll(async () => (await appPromise).close());

// A realm person with this role, a token that says so, and our user id for them.
async function realmMember(role: 'owner' | 'admin' | 'member'): Promise<Person> {
  const user = t.newUser();
  const { kcUserId } = await t.realmMembers(ent.realm).invite(user.email, role);
  const person = { ...user, sub: kcUserId };
  t.realmMembers(ent.realm).markSignedIn(person.sub);
  const token = await t.enterpriseToken(ent, person, [role]);
  const me = await t.request<{ user: { id: string } }>({ host: ent.host, path: '/api/me', token });
  return { user: person, token, userId: me.body.user.id };
}

const call = (as: Person, method: string, path: string, body?: unknown) =>
  t.request<{ detail?: string }>({
    host: ent.host,
    method,
    path,
    token: as.token,
    ...(body === undefined ? {} : { body }),
  });
const grant = (as: Person, target: Person) => call(as, 'POST', `/api/members/${target.userId}/console`);
const revoke = (as: Person, target: Person) => call(as, 'DELETE', `/api/members/${target.userId}/console`);
const audit = () => tenantTx(t.db, ent.id, (tx) => listAudit(tx, { limit: 20 }));
const fake = () => t.realmConsole(ent.realm);

beforeEach(async () => {
  t = await appPromise;
  ent = await t.seedEnterpriseTenant();
  owner = await realmMember('owner');
});

describe('console access', () => {
  it('an owner gives an admin console access, and takes it back', async () => {
    const admin = await realmMember('admin');
    expect((await grant(owner, admin)).status).toBe(204);
    expect(fake().members.has(admin.user.sub)).toBe(true);
    expect(await tenantTx(t.db, ent.id, (tx) => listConsole(tx))).toEqual([admin.userId]);
    expect((await revoke(owner, admin)).status).toBe(204);
    expect(fake().members.has(admin.user.sub)).toBe(false);
    const entries = (await audit()).filter((e) => e.action.startsWith('console.'));
    expect(entries.map((e) => [e.action, e.target])).toEqual([
      ['console.revoked', admin.userId],
      ['console.granted', admin.userId],
    ]);
    expect(entries[0]?.metadata).toEqual({});
  });

  it('refuses a member', async () => {
    const member = await realmMember('member');
    const res = await grant(owner, member);
    expect(res.status).toBe(422);
    expect(res.body.detail).toBe('Console access is for owners and admins.');
  });

  it('is for owners only', async () => {
    const admin = await realmMember('admin');
    const other = await realmMember('admin');
    expect((await grant(admin, other)).status).toBe(403);
  });

  it('is not on Standard workspaces', async () => {
    const standard = await t.seedTenant();
    const { token, user } = await t.member(standard, 'owners');
    const me = await t.request<{ user: { id: string } }>({ host: standard.host, path: '/api/me', token });
    const res = await t.request<{ detail: string }>({
      host: standard.host,
      method: 'POST',
      path: `/api/members/${me.body.user.id}/console`,
      token,
    });
    expect(res.status).toBe(404);
    expect(res.body.detail).toBe('Console access is available on Enterprise workspaces.');
    expect(user).toBeTruthy();
  });

  it('changing a console user to member takes access away; so does removing them', async () => {
    const a = await realmMember('admin');
    const b = await realmMember('admin');
    await grant(owner, a);
    await grant(owner, b);
    expect((await call(owner, 'PATCH', `/api/members/${a.userId}`, { role: 'member' })).status).toBeLessThan(
      300,
    );
    expect(fake().members.has(a.user.sub)).toBe(false);
    expect((await call(owner, 'DELETE', `/api/members/${b.userId}`)).status).toBeLessThan(300);
    expect(fake().members.has(b.user.sub)).toBe(false);
    expect(await tenantTx(t.db, ent.id, (tx) => listConsole(tx))).toEqual([]);
    const revoked = (await audit()).filter((e) => e.action === 'console.revoked');
    expect(revoked.map((e) => e.metadata)).toEqual([{ reason: 'role' }, { reason: 'role' }]);
  });

  it('owner deny list follows role changes', async () => {
    const admin = await realmMember('admin');
    const other = await realmMember('owner');
    await call(owner, 'PATCH', `/api/members/${admin.userId}`, { role: 'owner' });
    expect(fake().owners.sort()).toEqual([owner.user.sub, other.user.sub, admin.user.sub].sort());
    await call(owner, 'PATCH', `/api/members/${other.userId}`, { role: 'admin' });
    expect(fake().owners).not.toContain(other.user.sub);
    await call(owner, 'DELETE', `/api/members/${admin.userId}`);
    expect(fake().owners).toEqual([owner.user.sub]);
  });

  it('the members list says who has console access; /api/me gives console users the console URL', async () => {
    const admin = await realmMember('admin');
    await grant(owner, admin);
    const list = await t.request<{ members: { userId: string; console?: boolean }[] }>({
      host: ent.host,
      path: '/api/members',
      token: owner.token,
    });
    expect(list.body.members.find((m) => m.userId === admin.userId)?.console).toBe(true);
    expect(list.body.members.find((m) => m.userId === owner.userId)?.console).toBe(false);
    const me = await t.request<{ consoleUrl?: string }>({
      host: ent.host,
      path: '/api/me',
      token: admin.token,
    });
    expect(me.body.consoleUrl).toBe(fake().consoleUrl());
    const ownerMe = await t.request<{ consoleUrl?: string }>({
      host: ent.host,
      path: '/api/me',
      token: owner.token,
    });
    expect(ownerMe.body.consoleUrl).toBeUndefined();
  });

  it('a Keycloak refusal leaves no row', async () => {
    const admin = await realmMember('admin');
    fake().failNext(400);
    expect((await grant(owner, admin)).status).toBeGreaterThanOrEqual(400);
    expect(await tenantTx(t.db, ent.id, (tx) => listConsole(tx))).toEqual([]);
  });

  it('a demotion takes console access away in Keycloak even when our row is missing', async () => {
    const admin = await realmMember('admin');
    fake().members.add(admin.user.sub);
    await call(owner, 'PATCH', `/api/members/${admin.userId}`, { role: 'member' });
    expect(fake().members.has(admin.user.sub)).toBe(false);
  });

  it('a demotion outside Tenantry ends console access: no console URL, and gone at the next directory change', async () => {
    const admin = await realmMember('admin');
    await grant(owner, admin);
    // The directory (or the console itself) moved them out of the admins.
    await t.realmMembers(ent.realm).setRole(admin.user.sub, 'member');
    const me = await t.request<{ consoleUrl?: string }>({
      host: ent.host,
      path: '/api/me',
      token: admin.token,
    });
    expect(me.body.consoleUrl).toBeUndefined();
    const scimToken = (
      await t.request<{ token: string }>({
        host: ent.host,
        method: 'POST',
        path: '/api/scim/token',
        token: owner.token,
        body: { expiresInDays: 90 },
      })
    ).body.token;
    const scim = t.realmScim(ent.realm);
    const group = scim.groupNamed('tenantry-members');
    await t.request({
      host: ent.host,
      method: 'PATCH',
      path: `/scim/v2/Groups/${group}`,
      token: scimToken,
      body: { schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [] },
    });
    expect(fake().members.has(admin.user.sub)).toBe(false);
    expect(await tenantTx(t.db, ent.id, (tx) => listConsole(tx))).toEqual([]);
  });
});
