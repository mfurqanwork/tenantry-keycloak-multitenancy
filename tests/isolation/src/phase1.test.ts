// The Phase 1 rows of the README guarantees table, against the real stack. Rows 3 and 4 (the
// database itself) also run in packages/db: test-integration/rls.itest.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import { api, tenantHost } from './helpers/http.js';
import { addToTenant, createUser, tokenFor } from './helpers/keycloak.js';
import { signupTenant, type TestTenant } from './helpers/tenants.js';

interface Project {
  id: string;
  name: string;
}

let a: TestTenant;
let b: TestTenant;
let aProject: Project;
let bProject: Project;

async function createProject(t: TestTenant, name: string): Promise<Project> {
  const res = await api<Project>(tenantHost(t.slug), 'POST', '/api/projects', {
    token: t.ownerToken,
    body: { name },
  });
  expect(res.status).toBe(201);
  return res.body;
}

const projectIds = async (slug: string, token: string, headers?: Record<string, string>) => {
  const res = await api<{ projects: Project[] }>(tenantHost(slug), 'GET', '/api/projects', {
    token,
    ...(headers ? { headers } : {}),
  });
  expect(res.status).toBe(200);
  return res.body.projects.map((p) => p.id);
};

beforeAll(async () => {
  [a, b] = await Promise.all([signupTenant('a'), signupTenant('b')]);
  aProject = await createProject(a, 'A only');
  bProject = await createProject(b, 'B only');
});

describe('guarantee 1: tenant A user requests tenant B data with A token', () => {
  it("cannot read B's project by id on A's host (404: the row is invisible)", async () => {
    const res = await api(tenantHost(a.slug), 'GET', `/api/projects/${bProject.id}`, { token: a.ownerToken });
    expect(res.status).toBe(404);
  });
});

describe("guarantee 2: tenant A user calls B's subdomain with A token", () => {
  it('is refused with 403', async () => {
    const res = await api(tenantHost(b.slug), 'GET', '/api/projects', { token: a.ownerToken });
    expect(res.status).toBe(403);
  });

  it('is refused even with a token that asks for B but has no membership there', async () => {
    const res = await api(tenantHost(b.slug), 'GET', '/api/projects', {
      token: await tokenFor(a.owner, b.slug),
    });
    expect(res.status).toBe(403);
  });
});

describe('guarantee 3: a query that forgets the tenant filter', () => {
  it("lists only the caller's tenant rows (the projects query has no tenant filter)", async () => {
    const ids = await projectIds(a.slug, a.ownerToken);
    expect(ids).toContain(aProject.id);
    expect(ids).not.toContain(bProject.id);
  });
});

describe('guarantee 5: admin in A and member in B acts in B', () => {
  it('is treated as member in B', async () => {
    const both = await createUser('both');
    await addToTenant(both, a.slug, 'admins');
    await addToTenant(both, b.slug, 'members');
    const invite = { email: 'someone@example.com', role: 'member' };

    const inA = await api(tenantHost(a.slug), 'POST', '/api/members/invites', {
      token: await tokenFor(both, a.slug),
      body: { ...invite, email: `a-${both.email}` },
    });
    expect(inA.status).toBe(201);

    const inB = await api(tenantHost(b.slug), 'POST', '/api/members/invites', {
      token: await tokenFor(both, b.slug),
      body: invite,
    });
    expect(inB.status).toBe(403);

    // A's admin token presented on B's host carries no B role at all.
    const aTokenOnB = await api(tenantHost(b.slug), 'POST', '/api/members/invites', {
      token: await tokenFor(both, a.slug),
      body: invite,
    });
    expect(aTokenOnB.status).toBe(403);
  });
});

describe('guarantee 6: client sends a tenant id that differs from the token', () => {
  it('is ignored; the host and token decide', async () => {
    const ids = await projectIds(a.slug, a.ownerToken, {
      'x-tenant-id': b.slug,
      'x-tenant': b.slug,
      'x-organization': b.slug,
    });
    expect(ids).toContain(aProject.id);
    expect(ids).not.toContain(bProject.id);

    const viaQuery = await api<{ projects: Project[] }>(
      tenantHost(a.slug),
      'GET',
      `/api/projects?tenant=${b.slug}`,
      {
        token: a.ownerToken,
      },
    );
    expect(viaQuery.body.projects.map((p) => p.id)).not.toContain(bProject.id);
  });
});

describe('guarantee 7: member tries to invite, remove or change roles', () => {
  it('is refused with 403 each time', async () => {
    const member = await createUser('member');
    await addToTenant(member, a.slug, 'members');
    const token = await tokenFor(member, a.slug);
    const host = tenantHost(a.slug);

    const members = await api<{ members: { userId: string; email: string | null }[] }>(
      host,
      'GET',
      '/api/members',
      {
        token,
      },
    );
    expect(members.status).toBe(200);
    const ownerId = members.body.members.find((m) => m.email === a.owner.email)?.userId ?? '';

    expect(
      (
        await api(host, 'POST', '/api/members/invites', {
          token,
          body: { email: 'x@example.com', role: 'member' },
        })
      ).status,
    ).toBe(403);
    expect(
      (await api(host, 'PATCH', `/api/members/${ownerId}`, { token, body: { role: 'member' } })).status,
    ).toBe(403);
    expect((await api(host, 'DELETE', `/api/members/${ownerId}`, { token })).status).toBe(403);
  });
});
