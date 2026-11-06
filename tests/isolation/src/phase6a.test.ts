// The Phase 6a rows of the guarantees table (ADR-0028), against the real stack: notifications come from a
// workspace's own audit log, by role, and another workspace's invite reaches only its verified address.
import { beforeAll, describe, expect, it } from 'vitest';
import { api, tenantHost } from './helpers/http.js';
import { addToTenant, createUser, tokenFor, type TestUser } from './helpers/keycloak.js';
import { signupTenant, type TestTenant } from './helpers/tenants.js';

interface Feed {
  items: { kind: string; title: string; link: { workspace?: string } }[];
}

let a: TestTenant;
let b: TestTenant;
let memberOfA: TestUser;

const feed = async (slug: string, token: string) => {
  const res = await api<Feed>(tenantHost(slug), 'GET', '/api/notifications', { token });
  expect(res.status).toBe(200);
  return res.body.items;
};

beforeAll(async () => {
  [a, b] = await Promise.all([signupTenant('na'), signupTenant('nb')]);
  memberOfA = await createUser('nmember');
  await addToTenant(memberOfA, a.slug, 'members');
  // Something an owner or admin is told about, in each workspace.
  for (const [t, color] of [
    [a, '#0f62fe'],
    [b, '#198038'],
  ] as const) {
    const res = await api(tenantHost(t.slug), 'PUT', '/api/branding', {
      token: t.ownerToken,
      body: { primaryColor: color },
    });
    expect(res.status).toBe(200);
  }
});

describe('guarantee: notifications never show another workspace', () => {
  it("shows a person in both workspaces only this workspace's events", async () => {
    const both = await createUser('nboth');
    await addToTenant(both, a.slug, 'admins');
    await addToTenant(both, b.slug, 'admins');
    const inA = await feed(a.slug, await tokenFor(both, a.slug));
    const inB = await feed(b.slug, await tokenFor(both, b.slug));
    expect(inA.filter((i) => i.kind === 'workspace')).toHaveLength(1);
    expect(inB.filter((i) => i.kind === 'workspace')).toHaveLength(1);
    // B's token on A's address is refused before anything is read.
    const crossed = await api(tenantHost(a.slug), 'GET', '/api/notifications', {
      token: await tokenFor(both, b.slug),
    });
    expect(crossed.status).toBe(403);
  });
});

describe("guarantee: a member never sees an owner's or admin's notifications", () => {
  it('shows a member no team, workspace or security events', async () => {
    const items = await feed(a.slug, await tokenFor(memberOfA, a.slug));
    expect(items.map((i) => i.kind).filter((k) => ['team', 'workspace', 'security'].includes(k))).toEqual([]);
  });
});

describe("guarantee: another workspace's invite reaches only its verified address", () => {
  it('tells the invited person in their own workspace, and nobody else', async () => {
    const invited = await createUser('ninvited');
    await addToTenant(invited, a.slug, 'members');
    const res = await api(tenantHost(b.slug), 'POST', '/api/members/invites', {
      token: b.ownerToken,
      body: { email: invited.email, role: 'member' },
    });
    expect(res.status).toBe(201);
    const theirs = await feed(a.slug, await tokenFor(invited, a.slug));
    expect(theirs.find((i) => i.kind === 'invite')?.link.workspace).toBe(b.slug);
    const someoneElse = await feed(a.slug, await tokenFor(memberOfA, a.slug));
    expect(someoneElse.map((i) => i.kind)).not.toContain('invite');
  });
});
