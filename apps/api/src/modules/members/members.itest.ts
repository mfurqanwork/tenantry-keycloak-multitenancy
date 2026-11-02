import { listAudit, tenantTx } from '@tenantry/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant, type TestUser } from '../../testing/test-app.js';

interface MemberView {
  userId: string;
  email: string | null;
  role: string | null;
}
interface MembersBody {
  members: MemberView[];
  invites: { id: string; email: string; role: string }[];
}

let t: TestApp;
let acme: TestTenant;
let owner: { user: TestUser; token: string };
let admin: { user: TestUser; token: string };
let member: { user: TestUser; token: string };

const appPromise = createTestApp();
afterAll(async () => (await appPromise).close());

// A fresh tenant per test: owner counts and invites do not leak between cases.
beforeEach(async () => {
  t = await appPromise;
  acme = await t.seedTenant();
  owner = await t.member(acme, 'owners');
  admin = await t.member(acme, 'admins');
  member = await t.member(acme, 'members');
});

const as = (who: { token: string }) => ({
  get: <T>(path: string) => t.request<T>({ host: acme.host, path, token: who.token }),
  post: <T>(path: string, body: unknown) =>
    t.request<T>({ host: acme.host, method: 'POST', path, token: who.token, body }),
  patch: <T>(path: string, body: unknown) =>
    t.request<T>({ host: acme.host, method: 'PATCH', path, token: who.token, body }),
  del: (path: string) => t.request({ host: acme.host, method: 'DELETE', path, token: who.token }),
});

async function userIdOf(user: TestUser): Promise<string> {
  const res = await as(owner).get<MembersBody>('/api/members');
  const found = res.body.members.find((m) => m.email === user.email);
  if (!found) throw new Error(`${user.email} not listed`);
  return found.userId;
}

const actions = async () =>
  (await tenantTx(t.db, acme.id, (tx) => listAudit(tx, { limit: 50 }))).map((e) => e.action);

describe('GET /api/members', () => {
  it('lists members with their roles and open invites, for members too', async () => {
    await as(admin).post('/api/members/invites', { email: 'new@example.com', role: 'member' });
    const res = await as(member).get<MembersBody>('/api/members');
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(3);
    expect(res.body.members).toContainEqual(
      expect.objectContaining({ email: owner.user.email, role: 'owner' }),
    );
    expect(res.body.members.every((m) => /[0-9a-f-]{36}/.test(m.userId))).toBe(true);
    expect(res.body.invites).toEqual([expect.objectContaining({ email: 'new@example.com', role: 'member' })]);
  });
});

describe('invites', () => {
  it('lets an admin invite, through Keycloak, with an audit entry', async () => {
    const res = await as(admin).post('/api/members/invites', { email: 'bob@example.com', role: 'admin' });
    expect(res.status).toBe(201);
    expect(t.directory.invites).toContainEqual({ orgId: acme.kcOrgId, email: 'bob@example.com' });
    expect(await actions()).toContain('member.invited');
  });

  it('refuses members, duplicate emails in any case, and admins inviting owners', async () => {
    expect(
      (await as(member).post('/api/members/invites', { email: 'x@example.com', role: 'member' })).status,
    ).toBe(403);
    await as(admin).post('/api/members/invites', { email: 'bob@example.com', role: 'member' });
    expect(
      (await as(admin).post('/api/members/invites', { email: 'Bob@Example.com', role: 'member' })).status,
    ).toBe(409);
    expect(
      (await as(admin).post('/api/members/invites', { email: 'o@example.com', role: 'owner' })).status,
    ).toBe(403);
    expect(
      (await as(owner).post('/api/members/invites', { email: 'o@example.com', role: 'owner' })).status,
    ).toBe(201);
    expect(
      (await as(admin).post('/api/members/invites', { email: 'not-an-email', role: 'member' })).status,
    ).toBe(422);
  });

  it('revokes an open invite once', async () => {
    const created = await as(admin).post<{ id: string }>('/api/members/invites', {
      email: 'c@example.com',
      role: 'member',
    });
    expect((await as(admin).del(`/api/members/invites/${created.body.id}`)).status).toBe(204);
    expect(await actions()).toContain('invite.revoked');
    expect((await as(admin).del(`/api/members/invites/${created.body.id}`)).status).toBe(404);
    expect((await as(admin).del('/api/members/invites/nope')).status).toBe(404);
  });
});

describe('changing roles', () => {
  it('lets an admin promote a member, with from and to in the audit', async () => {
    const id = await userIdOf(member.user);
    const res = await as(admin).patch(`/api/members/${id}`, { role: 'admin' });
    expect(res.status).toBe(200);
    const listed = await t.directory.listMembers(acme.kcOrgId);
    expect(listed.find((m) => m.kcUserId === member.user.sub)?.group).toBe('admins');
    const [entry] = await tenantTx(t.db, acme.id, (tx) => listAudit(tx, { limit: 1 }));
    expect(entry).toMatchObject({
      action: 'member.role_changed',
      target: id,
      metadata: { from: 'member', to: 'admin' },
    });
  });

  it('keeps owners for owners, and nobody changes themselves', async () => {
    expect(
      (await as(admin).patch(`/api/members/${await userIdOf(owner.user)}`, { role: 'member' })).status,
    ).toBe(403);
    expect(
      (await as(admin).patch(`/api/members/${await userIdOf(member.user)}`, { role: 'owner' })).status,
    ).toBe(403);
    expect(
      (await as(admin).patch(`/api/members/${await userIdOf(admin.user)}`, { role: 'member' })).status,
    ).toBe(403);
    expect(
      (await as(member).patch(`/api/members/${await userIdOf(admin.user)}`, { role: 'member' })).status,
    ).toBe(403);
  });

  it('never leaves the tenant without an owner', async () => {
    const second = await t.member(acme, 'owners');
    const ownerId = await userIdOf(owner.user);
    const secondId = await userIdOf(second.user);
    // Two owners: one may go.
    expect((await as(owner).del(`/api/members/${secondId}`)).status).toBe(204);
    // Now the last owner can neither be demoted nor removed, even by another owner-to-be.
    const third = await t.member(acme, 'owners');
    expect((await as(third).del(`/api/members/${ownerId}`)).status).toBe(204);
    const thirdId = await userIdOf(third.user);
    // The removed owner's token still says owner until it expires (5 min); the owner count still stops them.
    expect((await as(owner).patch(`/api/members/${thirdId}`, { role: 'admin' })).status).toBe(409);
    expect(
      (
        await t.request({
          host: acme.host,
          method: 'DELETE',
          path: `/api/members/${thirdId}`,
          token: third.token,
        })
      ).status,
    ).toBe(409);
  });

  it('answers 404 for someone who is not a member here', async () => {
    const other = await t.seedTenant();
    const outsider = await t.member(other, 'members');
    await t.request({ host: other.host, path: '/api/me', token: outsider.token });
    const res = await t.request<{ user: { id: string } }>({
      host: other.host,
      path: '/api/me',
      token: outsider.token,
    });
    expect((await as(admin).patch(`/api/members/${res.body.user.id}`, { role: 'admin' })).status).toBe(404);
    expect((await as(admin).del(`/api/members/${res.body.user.id}`)).status).toBe(404);
  });
});

describe('removing members', () => {
  it('lets an admin remove a member, with an audit entry', async () => {
    const id = await userIdOf(member.user);
    expect((await as(admin).del(`/api/members/${id}`)).status).toBe(204);
    expect((await t.directory.listMembers(acme.kcOrgId)).some((m) => m.kcUserId === member.user.sub)).toBe(
      false,
    );
    expect(await actions()).toContain('member.removed');
  });

  it('refuses members and admins removing an owner', async () => {
    expect((await as(member).del(`/api/members/${await userIdOf(admin.user)}`)).status).toBe(403);
    expect((await as(admin).del(`/api/members/${await userIdOf(owner.user)}`)).status).toBe(403);
  });

  it('refuses removing the last owner', async () => {
    expect((await as(owner).del(`/api/members/${await userIdOf(owner.user)}`)).status).toBe(409);
  });
});
