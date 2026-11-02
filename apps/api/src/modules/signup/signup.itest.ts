import { randomUUID } from 'node:crypto';
import type { IdentityDirectory } from '@tenantry/keycloak-admin';
import { createAppPool, listAudit, platformRepository, tenantTx } from '@tenantry/db';
import { stackEnv } from '../../testing/env.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../../testing/test-app.js';

let t: TestApp;
const newSlug = () => `s${randomUUID().slice(0, 8)}`;

beforeAll(async () => {
  t = await createTestApp();
});
afterEach(() => {
  t.directory.clearFailures();
});
afterAll(() => t.close());

async function signup(slug: string, name = 'Acme Inc', user = t.newUser()) {
  return t.request<{ slug: string; url: string }>({
    host: t.apexHost,
    method: 'POST',
    path: '/api/signup',
    token: await t.token(user),
    body: { name, slug },
  });
}

const orgsWithAlias = (alias: string) => [...t.directory.orgs.values()].filter((o) => o.alias === alias);

describe('POST /api/signup', () => {
  it('creates the tenant, its organization and groups, and makes the caller owner', async () => {
    const owner = t.newUser();
    const slug = newSlug();
    const res = await signup(slug, 'Acme Inc', owner);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ slug, url: `http://${slug}.tenantry.localhost` });

    const tenant = await platformRepository(t.db).findTenantBySlug(slug);
    expect(tenant).toMatchObject({
      status: 'active',
      name: 'Acme Inc',
      realm: 'platform',
      issuer: t.issuer.issuer,
    });
    const orgId = tenant?.kcOrgId ?? '';
    expect(t.directory.orgs.get(orgId)?.groups).toBe(true);
    expect(await t.directory.listMembers(orgId)).toEqual([
      expect.objectContaining({ kcUserId: owner.sub, group: 'owners' }),
    ]);
    expect(t.directory.origins.has(`http://${slug}.tenantry.localhost`)).toBe(true);
    const audit = await tenantTx(t.db, tenant?.id ?? '', (tx) => listAudit(tx, { limit: 5 }));
    expect(audit.map((e) => e.action)).toEqual(['tenant.created']);

    // The new owner can use the tenant at once.
    const me = await t.request<{ role: string }>({
      host: `${slug}.tenantry.localhost`,
      path: '/api/me',
      token: await t.token(owner, { alias: slug, groups: ['/owners'] }),
    });
    expect(me.body.role).toBe('owner');
  });

  it.each<keyof IdentityDirectory>([
    'createOrganization',
    'createGroups',
    'addMember',
    'setMemberGroup',
    'addTenantOrigin',
  ])('undoes everything when %s fails, and the slug can be used again', async (step) => {
    const slug = newSlug();
    t.directory.failOn(step);
    const res = await signup(slug);
    expect(res.status).toBe(502);
    expect((await platformRepository(t.db).findTenantBySlug(slug))?.status).toBe('failed');
    expect(orgsWithAlias(slug)).toEqual([]);
    expect(t.directory.origins.has(`http://${slug}.tenantry.localhost`)).toBe(false);

    t.directory.clearFailures();
    expect((await signup(slug)).status).toBe(201);
    expect(orgsWithAlias(slug)).toHaveLength(1);
  });

  it('lets two workspaces share a display name', async () => {
    expect((await signup(newSlug(), 'Same Name')).status).toBe(201);
    expect((await signup(newSlug(), 'Same Name')).status).toBe(201);
  });

  it('replaces a signup whose process died mid-way', async () => {
    const slug = newSlug();
    const { id } = await platformRepository(t.db).insertProvisioningTenant({ slug, name: 'Crashed' });
    const owner = createAppPool(stackEnv('DATABASE_OWNER_URL'));
    await owner.query(`update tenants set created_at = now() - interval '11 minutes' where id = $1`, [id]);
    await owner.end();
    expect((await signup(slug)).status).toBe(201);
  });

  it('cleans up an organization left behind by a lost Keycloak response', async () => {
    const slug = newSlug();
    // Keycloak created it, but the API never learned the id.
    await t.directory.createOrganization({ alias: slug, name: slug });
    expect((await signup(slug)).status).toBe(201);
    expect(orgsWithAlias(slug)).toHaveLength(1);
  });

  it('answers 409 for a slug that is taken', async () => {
    const slug = newSlug();
    expect((await signup(slug)).status).toBe(201);
    expect((await signup(slug)).status).toBe(409);
  });

  it('lets exactly one of two concurrent signups for a slug win', async () => {
    const slug = newSlug();
    const results = await Promise.all([signup(slug), signup(slug)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(orgsWithAlias(slug)).toHaveLength(1);
  });

  it('refuses bad input', async () => {
    expect((await signup('Bad Slug')).status).toBe(422);
    expect((await signup('admin')).status).toBe(422);
    expect((await signup(newSlug(), '')).status).toBe(422);
    expect((await signup(newSlug(), 'x'.repeat(81))).status).toBe(422);
  });

  it('only runs on the apex host, for a signed-in caller', async () => {
    const tenantHost = await t.request({
      host: 'acme.tenantry.localhost',
      method: 'POST',
      path: '/api/signup',
      token: await t.token(t.newUser()),
      body: { name: 'X', slug: newSlug() },
    });
    expect(tenantHost.status).toBe(404);
    const anonymous = await t.request({
      host: t.apexHost,
      method: 'POST',
      path: '/api/signup',
      body: { name: 'X', slug: newSlug() },
    });
    expect(anonymous.status).toBe(401);
  });
});

describe('GET /api/signup/slug-availability', () => {
  const check = async (slug: string) =>
    t.request<{ available: boolean; reason?: string }>({
      host: t.apexHost,
      path: `/api/signup/slug-availability?slug=${encodeURIComponent(slug)}`,
      token: await t.token(t.newUser()),
    });

  it('says why a slug is not available', async () => {
    const taken = newSlug();
    await signup(taken);
    expect((await check(newSlug())).body).toEqual({ available: true });
    expect((await check(taken)).body).toEqual({ available: false, reason: 'taken' });
    expect((await check('admin')).body).toEqual({ available: false, reason: 'reserved' });
    expect((await check('-x')).body).toEqual({ available: false, reason: 'format' });
  });

  it('treats a failed signup as available again', async () => {
    const slug = newSlug();
    t.directory.failOn('createGroups');
    await signup(slug);
    t.directory.clearFailures();
    expect((await check(slug)).body).toEqual({ available: true });
  });
});
