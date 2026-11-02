import { platformRepository } from '@tenantry/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant } from '../../testing/test-app.js';

let t: TestApp;
let acme: TestTenant;

beforeAll(async () => {
  t = await createTestApp();
  acme = await t.seedTenant();
});
afterAll(() => t.close());

describe('GET /api/tenants/:slug/auth-config', () => {
  it('tells the SPA where to sign in, without a token', async () => {
    const res = await t.request({ host: acme.host, path: `/api/tenants/${acme.slug}/auth-config` });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ issuer: t.issuer.issuer, clientId: 'tenantry-web', organization: acme.slug });
  });

  it('answers 404 for an unknown or failed tenant', async () => {
    expect((await t.request({ host: t.apexHost, path: '/api/tenants/nobody/auth-config' })).status).toBe(404);
    const failed = await t.seedTenant();
    await platformRepository(t.db).markTenantFailed(failed.id);
    expect(
      (await t.request({ host: t.apexHost, path: `/api/tenants/${failed.slug}/auth-config` })).status,
    ).toBe(404);
  });
});

describe('GET /api/me', () => {
  it('describes the caller in this tenant', async () => {
    const { user, token } = await t.member(acme, 'admins');
    const res = await t.request<{
      user: { email: string };
      tenant: { slug: string };
      role: string;
      permissions: string[];
    }>({ host: acme.host, path: '/api/me', token });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.tenant.slug).toBe(acme.slug);
    expect(res.body.role).toBe('admin');
    expect(res.body.permissions).toContain('members:invite');
    expect(res.body.permissions).not.toContain('tenant:settings');
  });
});
