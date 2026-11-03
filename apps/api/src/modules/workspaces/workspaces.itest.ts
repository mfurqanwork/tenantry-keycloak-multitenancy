import { platformRepository } from '@tenantry/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant, type TestUser } from '../../testing/test-app.js';

interface Workspace {
  slug: string;
  name: string;
  current: boolean;
  webUrl: string;
  portalUrl: string;
}

let t: TestApp;
let a: TestTenant;
let b: TestTenant;
let c: TestTenant;
let pat: TestUser;

beforeAll(async () => {
  t = await createTestApp();
  a = await t.seedTenant();
  b = await t.seedTenant();
  c = await t.seedTenant();
  pat = t.newUser();
  await t.join(a, pat, 'members');
  await t.join(b, pat, 'admins');
  await t.join(c, pat, 'members');
  await platformRepository(t.db).markTenantFailed(c.id);
});
afterAll(() => t.close());

describe('GET /api/me/workspaces', () => {
  it('lists the active workspaces the caller belongs to and marks this one', async () => {
    const token = await t.token(pat, { alias: a.slug, groups: ['/members'] });
    const res = await t.request<Workspace[]>({ host: a.host, path: '/api/me/workspaces', token });
    expect(res.status).toBe(200);
    expect(res.body.map((w) => w.slug).sort()).toEqual([a.slug, b.slug].sort());
    expect(res.body.find((w) => w.slug === a.slug)).toEqual({
      slug: a.slug,
      name: `Tenant ${a.slug}`,
      current: true,
      webUrl: `http://${a.slug}.tenantry.localhost/`,
      portalUrl: `http://${a.slug}.portal.tenantry.localhost/`,
    });
    expect(res.body.find((w) => w.slug === b.slug)?.current).toBe(false);
  });

  it('marks the current workspace on the portal host too', async () => {
    const token = await t.token(pat, { alias: b.slug, groups: ['/admins'] });
    const res = await t.request<Workspace[]>({
      host: `${b.slug}.portal.tenantry.localhost`,
      path: '/api/me/workspaces',
      token,
    });
    expect(res.body.find((w) => w.current)?.slug).toBe(b.slug);
  });

  it('needs a signed-in member of this workspace', async () => {
    expect((await t.request({ host: a.host, path: '/api/me/workspaces' })).status).toBe(401);
  });

  describe('workspaces on an enterprise tenant', () => {
    it('lists only this workspace, without asking the platform realm', async () => {
      const ent = await t.seedEnterpriseTenant();
      t.directory.failOn('listUserOrganizations');
      const token = await t.enterpriseToken(ent, t.newUser(), ['member']);
      const res = await t.request<Workspace[]>({ host: ent.host, path: '/api/me/workspaces', token });
      t.directory.clearFailures();
      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          slug: ent.slug,
          name: `Enterprise ${ent.slug}`,
          current: true,
          webUrl: `http://${ent.slug}.tenantry.localhost/`,
          portalUrl: `http://${ent.slug}.portal.tenantry.localhost/`,
        },
      ]);
    });
  });
});
