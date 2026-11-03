import { listAudit, tenantTx } from '@tenantry/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant, type TestUser } from '../../testing/test-app.js';

interface MembersBody {
  members: { userId: string; email: string | null; role: string | null }[];
  invites: { id: string; email: string; role: string }[];
}

type Ent = TestTenant & { issuer: string; realm: string };

let t: TestApp;
let ent: Ent;
let owner: { user: TestUser; token: string };

const appPromise = createTestApp();
afterAll(async () => (await appPromise).close());

// An enterprise owner is a realm user with the owner role on tenantry-api.
async function realmMember(tenant: Ent, role: 'owner' | 'admin' | 'member') {
  const user = t.newUser();
  const { kcUserId } = await t.realmMembers(tenant.realm).invite(user.email, role);
  const person = { ...user, sub: kcUserId };
  t.realmMembers(tenant.realm).markSignedIn(person.sub);
  return { user: person, token: await t.enterpriseToken(tenant, person, [role]) };
}

beforeEach(async () => {
  t = await appPromise;
  ent = await t.seedEnterpriseTenant();
  owner = await realmMember(ent, 'owner');
});

const as = (who: { token: string }) => ({
  get: <T>(path: string) => t.request<T>({ host: ent.host, path, token: who.token }),
  post: <T>(path: string, body: unknown) =>
    t.request<T>({ host: ent.host, method: 'POST', path, token: who.token, body }),
  patch: <T>(path: string, body: unknown) =>
    t.request<T>({ host: ent.host, method: 'PATCH', path, token: who.token, body }),
  del: (path: string) => t.request({ host: ent.host, method: 'DELETE', path, token: who.token }),
});
const actions = async () =>
  (await tenantTx(t.db, ent.id, (tx) => listAudit(tx, { limit: 50 }))).map((e) => e.action);

describe('members on an enterprise tenant', () => {
  it("lists the realm's people who hold one of our roles", async () => {
    const admin = await realmMember(ent, 'admin');
    const res = await as(owner).get<MembersBody>('/api/members');
    expect(res.status).toBe(200);
    expect(res.body.members.map((m) => [m.email, m.role]).sort()).toEqual(
      [
        [owner.user.email, 'owner'],
        [admin.user.email, 'admin'],
      ].sort(),
    );
  });

  it('invites someone new: their account exists at once with the role, and the invite stays open', async () => {
    const res = await as(owner).post('/api/members/invites', {
      email: 'new.person@example.com',
      role: 'member',
    });
    expect(res.status).toBe(201);
    expect(t.realmMembers(ent.realm).emailsSent).toContain('new.person@example.com');
    const body = (await as(owner).get<MembersBody>('/api/members')).body;
    expect(body.members.find((m) => m.email === 'new.person@example.com')?.role).toBe('member');
    expect(body.invites.map((i) => i.email)).toContain('new.person@example.com');
    expect(await actions()).toContain('member.invited');
  });

  it('accepts the invite when the person first signs in', async () => {
    await as(owner).post('/api/members/invites', { email: 'joiner@example.com', role: 'admin' });
    const joinerId =
      [...t.realmMembers(ent.realm).users].find(([, u]) => u.email === 'joiner@example.com')?.[0] ?? '';
    const token = await t.enterpriseToken(ent, { sub: joinerId, email: 'joiner@example.com' }, ['admin']);
    expect((await t.request({ host: ent.host, path: '/api/me', token })).status).toBe(200);
    const body = (await as(owner).get<MembersBody>('/api/members')).body;
    expect(body.invites.map((i) => i.email)).not.toContain('joiner@example.com');
    expect(await actions()).toContain('member.joined');
  });

  it('revoking deletes an invitee who never signed in, but not someone who did', async () => {
    const unused = await as(owner).post<{ id: string }>('/api/members/invites', {
      email: 'never@example.com',
      role: 'member',
    });
    expect((await as(owner).del(`/api/members/invites/${unused.body.id}`)).status).toBe(204);
    expect([...t.realmMembers(ent.realm).users.values()].some((u) => u.email === 'never@example.com')).toBe(
      false,
    );

    const used = await as(owner).post<{ id: string }>('/api/members/invites', {
      email: 'signedin@example.com',
      role: 'member',
    });
    const usedId =
      [...t.realmMembers(ent.realm).users].find(([, u]) => u.email === 'signedin@example.com')?.[0] ?? '';
    t.realmMembers(ent.realm).markSignedIn(usedId);
    await as(owner).del(`/api/members/invites/${used.body.id}`);
    expect(t.realmMembers(ent.realm).users.has(usedId)).toBe(true);
  });

  it('changes a role and removes a member through the realm', async () => {
    const member = await realmMember(ent, 'member');
    const id = (await as(owner).get<MembersBody>('/api/members')).body.members.find(
      (m) => m.email === member.user.email,
    )?.userId;
    expect((await as(owner).patch(`/api/members/${id ?? ''}`, { role: 'admin' })).status).toBe(200);
    expect(t.realmMembers(ent.realm).users.get(member.user.sub)?.role).toBe('admin');
    expect((await as(owner).del(`/api/members/${id ?? ''}`)).status).toBe(204);
    expect(t.realmMembers(ent.realm).users.get(member.user.sub)?.role).toBeNull();
    expect(await actions()).toEqual(expect.arrayContaining(['member.role_changed', 'member.removed']));
  });

  it('keeps an owner, and lets a member leave', async () => {
    expect((await as(owner).del('/api/members/me')).status).toBe(409);
    const member = await realmMember(ent, 'member');
    expect((await as(member).del('/api/members/me')).status).toBe(204);
  });

  it('refuses members inviting', async () => {
    const member = await realmMember(ent, 'member');
    expect(
      (await as(member).post('/api/members/invites', { email: 'x@example.com', role: 'member' })).status,
    ).toBe(403);
  });
});
