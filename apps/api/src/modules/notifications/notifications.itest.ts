import { createHash, randomBytes } from 'node:crypto';
import { createInvite, insertAudit, insertScimToken, tenantTx } from '@tenantry/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant, type TestUser } from '../../testing/test-app.js';

interface Person {
  user: TestUser;
  token: string;
  userId: string;
}
interface Feed {
  items: {
    id: string;
    kind: string;
    title: string;
    unread: boolean;
    link: { app: string; path: string; workspace?: string };
  }[];
  unread: number;
}

let t: TestApp;
let ws: TestTenant;
let owner: Person;
let admin: Person;
let member: Person;
const appPromise = createTestApp();
afterAll(async () => (await appPromise).close());

async function person(tenant: TestTenant, group: 'owners' | 'admins' | 'members', user?: TestUser) {
  const u = user ?? t.newUser();
  await t.join(tenant, u, group);
  const token = await t.token(u, { alias: tenant.slug, groups: [`/${group}`] });
  const me = await t.request<{ user: { id: string } }>({ host: tenant.host, path: '/api/me', token });
  return { user: u, token, userId: me.body.user.id };
}
const feed = async (as: Person, tenant = ws, token = as.token) =>
  (await t.request<Feed>({ host: tenant.host, path: '/api/notifications', token })).body;
const event = (tenant: TestTenant, action: string, target: string, actor: string | null, metadata = {}) =>
  tenantTx(t.db, tenant.id, (tx) => insertAudit(tx, { actorUserId: actor, action, target, metadata }));

beforeAll(async () => {
  t = await appPromise;
  ws = await t.seedTenant();
  owner = await person(ws, 'owners');
  admin = await person(ws, 'admins');
  member = await person(ws, 'members');
  await event(ws, 'member.joined', member.userId, null, { role: 'member' });
  await event(ws, 'branding.updated', ws.id, admin.userId);
  await event(ws, 'security.updated', ws.id, admin.userId);
  await event(ws, 'member.role_changed', member.userId, owner.userId, { from: 'member', to: 'member' });
  await event(ws, 'project.created', 'p1', admin.userId);
});

describe('notifications (spec 8.4)', () => {
  it('shows an owner the team, the workspace and security, never what they did themselves', async () => {
    const kinds = (await feed(owner)).items.map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(['team', 'workspace', 'security']));
    expect((await feed(owner)).items.map((i) => i.title)).not.toContain('Your role is now Member');
  });

  it('shows an admin no security events, and not their own changes', async () => {
    const items = (await feed(admin)).items;
    expect(items.map((i) => i.kind)).not.toContain('security');
    expect(items.map((i) => i.kind)).not.toContain('workspace');
    expect(items.find((i) => i.kind === 'team')?.title).toMatch(/joined/);
  });

  it('shows a member only what is about them (Review Focus 1)', async () => {
    const items = (await feed(member)).items;
    expect(items.map((i) => i.kind)).toEqual(['you']);
    expect(items[0]?.title).toBe('Your role is now Member');
  });

  it('counts unread until "Mark all as read", and a newer event counts again', async () => {
    const reader = await person(ws, 'admins');
    expect((await feed(reader)).unread).toBeGreaterThan(0);
    const read = await t.request({
      host: ws.host,
      method: 'POST',
      path: '/api/notifications/read',
      token: reader.token,
    });
    expect(read.status).toBe(204);
    expect((await feed(reader)).unread).toBe(0);
    await new Promise((r) => setTimeout(r, 5));
    await event(ws, 'member.left', member.userId, member.userId);
    expect((await feed(reader)).unread).toBe(1);
  });

  it('warns owners about a directory sync token expiring within 14 days', async () => {
    const other = await t.seedTenant();
    const o = await person(other, 'owners');
    const hash = () => createHash('sha256').update(randomBytes(16)).digest();
    await tenantTx(t.db, other.id, (tx) =>
      insertScimToken(tx, {
        tokenHash: hash(),
        expiresAt: new Date(Date.now() + 20 * 86400000),
        createdBy: null,
      }),
    );
    expect((await feed(o, other)).items.map((i) => i.kind)).not.toContain('expiring');
    await tenantTx(t.db, other.id, (tx) =>
      insertScimToken(tx, {
        tokenHash: hash(),
        expiresAt: new Date(Date.now() + 10 * 86400000),
        createdBy: null,
      }),
    );
    expect((await feed(o, other)).items.find((i) => i.kind === 'expiring')?.title).toBe(
      'The directory sync token expires in 10 days',
    );
  });
});

describe('guarantee: notifications stay in their workspace', () => {
  it("never shows another workspace's events, even to someone in both (Review Focus 2)", async () => {
    const other = await t.seedTenant();
    const both = await person(ws, 'owners');
    const there = await person(other, 'owners', both.user);
    await event(other, 'branding.updated', other.id, null);
    await event(other, 'member.joined', 'someone-else', null);
    const here = (await feed(both)).items;
    const otherIds = (await feed(there, other)).items.map((i) => i.id);
    expect(here.map((i) => i.id).filter((id) => otherIds.includes(id))).toEqual([]);
  });

  it("shows another workspace's invite only to its verified address (Review Focus 3)", async () => {
    const other = await t.seedTenant();
    const inviter = await person(other, 'owners');
    const invited = await person(ws, 'members');
    await tenantTx(t.db, other.id, (tx) =>
      createInvite(tx, { email: invited.user.email, role: 'admin', invitedBy: inviter.userId }),
    );
    const items = (await feed(invited)).items;
    expect(items.find((i) => i.kind === 'invite')).toMatchObject({
      title: `You're invited to Tenant ${other.slug}`,
      link: { app: 'web', path: '/', workspace: other.slug },
    });
    // "Mark all as read" counts the invite as read too, until a newer one arrives.
    await t.request({ host: ws.host, method: 'POST', path: '/api/notifications/read', token: invited.token });
    expect((await feed(invited)).items.find((i) => i.kind === 'invite')?.unread).toBe(false);
    const unverified = await t.token(
      invited.user,
      { alias: ws.slug, groups: ['/members'] },
      { email_verified: false },
    );
    expect((await feed(invited, ws, unverified)).items.map((i) => i.kind)).not.toContain('invite');
    expect((await feed(member)).items.map((i) => i.kind)).not.toContain('invite');
  });
});
