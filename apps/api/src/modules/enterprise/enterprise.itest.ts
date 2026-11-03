import { randomUUID } from 'node:crypto';
import { listAudit, platformRepository, tenantTx } from '@tenantry/db';
import type { RealmProvisioner } from '@tenantry/keycloak-admin';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../../testing/test-app.js';

interface Provisioned {
  slug: string;
  status: string;
  realm: string;
  webUrl: string;
  portalUrl: string;
}
interface Upgrade {
  slug: string;
  fromVersion: number;
  toVersion: number;
  differences: { path: string }[];
  applied: boolean;
}

let t: TestApp;
let operator: string;

beforeAll(async () => {
  t = await createTestApp();
  operator = await t.operatorToken();
});
afterAll(() => t.close());
beforeEach(() => {
  t.provisioner.clearFailures();
});

const slug = () => `ent${randomUUID().slice(0, 6)}`;
const provision = (body: Record<string, unknown>, token = operator) =>
  t.request<Provisioned>({
    host: t.apexHost,
    method: 'POST',
    path: '/api/platform/enterprise-tenants',
    token,
    body,
  });
const upgrade = (body: Record<string, unknown>) =>
  t.request<Upgrade[]>({
    host: t.apexHost,
    method: 'POST',
    path: '/api/platform/enterprise-tenants/upgrade',
    token: operator,
    body,
  });
const auditOf = async (tenantId: string) => tenantTx(t.db, tenantId, (tx) => listAudit(tx, { limit: 50 }));

describe('POST /api/platform/enterprise-tenants', () => {
  it('builds a working enterprise tenant', async () => {
    const s = slug();
    const res = await provision({ slug: s, name: 'Initech', adminEmail: `owner@${s}.test` });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      slug: s,
      status: 'active',
      realm: `ent-${s}`,
      webUrl: `http://${s}.tenantry.localhost/`,
      portalUrl: `http://${s}.portal.tenantry.localhost/`,
    });
    const tenant = await platformRepository(t.db).findTenantBySlug(s);
    expect(tenant).toMatchObject({
      tier: 'enterprise',
      status: 'active',
      realm: `ent-${s}`,
      issuer: `${t.issuer.baseUrl}/realms/ent-${s}`,
      kcOrgId: null,
      templateVersion: 1,
    });
    const realm = t.provisioner.realms.get(`ent-${s}`);
    expect(realm?.admins.has(`owner@${s}.test`)).toBe(true);
    expect([...(realm?.clients.keys() ?? [])].sort()).toEqual([
      'tenantry-api',
      'tenantry-backend',
      'tenantry-portal',
      'tenantry-web',
    ]);
    expect(await t.secrets.get(`ent-${s}/tenantry-backend`)).toBe(realm?.backendSecret);
    const actions = (await auditOf(tenant?.id ?? '')).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['tenant.provisioning', 'tenant.created']));
  });

  it('never shows the backend secret in its answer or the audit log', async () => {
    const s = slug();
    const res = await provision({ slug: s, name: 'Secretive', adminEmail: `owner@${s}.test` });
    const secret = (await t.secrets.get(`ent-${s}/tenantry-backend`)) ?? 'missing';
    expect(JSON.stringify(res.body)).not.toContain(secret);
    const tenant = await platformRepository(t.db).findTenantBySlug(s);
    expect(JSON.stringify(await auditOf(tenant?.id ?? ''))).not.toContain(secret);
  });

  it('changes nothing the second time', async () => {
    const s = slug();
    await provision({ slug: s, name: 'Twice', adminEmail: `owner@${s}.test` });
    const sent = t.provisioner.emailsSent.length;
    const res = await provision({ slug: s, name: 'Twice', adminEmail: `owner@${s}.test` });
    expect(res.status).toBe(200);
    expect(t.provisioner.emailsSent.length).toBe(sent);
  });

  it.each<keyof RealmProvisioner>([
    'ensureRealm',
    'applyTemplate',
    'ensureClients',
    'setBackendSecret',
    'ensureFirstAdmin',
    'smokeTest',
  ])('finishes on a rerun after %s fails, with one realm, one secret and one admin', async (step) => {
    const s = slug();
    const body = { slug: s, name: 'Resumed', adminEmail: `owner@${s}.test` };
    t.provisioner.failOn(step);
    expect((await provision(body)).status).toBe(502);
    expect((await platformRepository(t.db).findTenantBySlug(s))?.status).toBe('provisioning');
    const secretBefore = await t.secrets.get(`ent-${s}/tenantry-backend`);
    t.provisioner.clearFailures();
    expect((await provision(body)).status).toBe(201);
    expect((await platformRepository(t.db).findTenantBySlug(s))?.status).toBe('active');
    const realm = t.provisioner.realms.get(`ent-${s}`);
    expect(realm?.admins.size).toBe(1);
    if (secretBefore) expect(await t.secrets.get(`ent-${s}/tenantry-backend`)).toBe(secretBefore);
    expect(t.provisioner.emailsSent.filter((e) => e.realm === `ent-${s}`)).toHaveLength(1);
  });

  it("refuses a Standard tenant's slug, a bad slug, and a person's token", async () => {
    const standard = await t.seedTenant();
    expect((await provision({ slug: standard.slug, name: 'X', adminEmail: 'a@b.test' })).status).toBe(409);
    expect((await provision({ slug: 'Bad Slug', name: 'X', adminEmail: 'a@b.test' })).status).toBe(422);
    expect((await provision({ slug: 'portal', name: 'X', adminEmail: 'a@b.test' })).status).toBe(422);
    const person = await t.token(t.newUser());
    expect((await provision({ slug: slug(), name: 'X', adminEmail: 'a@b.test' }, person)).status).toBe(403);
  });
});

describe('POST /api/platform/enterprise-tenants/upgrade', () => {
  it('reports drift on a dry run without changing anything, then applies it', async () => {
    const s = slug();
    await provision({ slug: s, name: 'Drifting', adminEmail: `owner@${s}.test` });
    const realm = t.provisioner.realms.get(`ent-${s}`);
    if (realm) realm.settings['accessTokenLifespan'] = 900;

    const dry = await upgrade({ slug: s, dryRun: true });
    expect(dry.status).toBe(200);
    expect(dry.body).toEqual([
      expect.objectContaining({
        slug: s,
        applied: false,
        differences: [expect.objectContaining({ path: 'realm.accessTokenLifespan' })],
      }),
    ]);
    expect(realm?.settings['accessTokenLifespan']).toBe(900);

    const real = await upgrade({ slug: s, dryRun: false });
    expect(real.body[0]?.applied).toBe(true);
    expect(realm?.settings['accessTokenLifespan']).toBe(300);
    const tenant = await platformRepository(t.db).findTenantBySlug(s);
    expect((await auditOf(tenant?.id ?? '')).map((e) => e.action)).toContain('tenant.upgraded');
    expect((await upgrade({ slug: s, dryRun: true })).body[0]?.differences).toEqual([]);
  });

  it('answers 404 for a slug that is not an enterprise tenant', async () => {
    const standard = await t.seedTenant();
    expect((await upgrade({ slug: standard.slug, dryRun: true })).status).toBe(404);
  });
});
