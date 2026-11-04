import { Controller, Get, Req } from '@nestjs/common';
import { platformRepository } from '@tenantry/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant } from '../testing/test-app.js';
import { OperatorOnly } from './decorators.js';
import type { AuthedRequest } from './request-context.js';

@Controller('platform/probe')
class OperatorProbeController {
  @Get()
  @OperatorOnly()
  get(@Req() req: AuthedRequest) {
    return { operator: req.operator };
  }
}

interface Me {
  user: { id: string; email: string };
  role: string;
}

let t: TestApp;
let ent: TestTenant & { issuer: string; realm: string };
let other: TestTenant & { issuer: string; realm: string };
let standard: TestTenant;

beforeAll(async () => {
  t = await createTestApp({ controllers: [OperatorProbeController] });
  ent = await t.seedEnterpriseTenant();
  other = await t.seedEnterpriseTenant();
  standard = await t.seedTenant();
});
afterAll(() => t.close());

const me = (host: string, token?: string) =>
  t.request<Me>({ host, path: '/api/me', ...(token ? { token } : {}) });

describe('the Enterprise path', () => {
  it("accepts a token from the tenant's own realm, with its tenantry-api role", async () => {
    const user = t.newUser();
    const res = await me(ent.host, await t.enterpriseToken(ent, user, ['owner']));
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('owner');
  });

  it('refuses a platform-realm token on an enterprise host', async () => {
    const { token } = await t.member(standard, 'owners');
    expect((await me(ent.host, token)).status).toBe(401);
  });

  it("refuses another enterprise realm's token", async () => {
    const token = await t.enterpriseToken(other, t.newUser(), ['owner']);
    expect((await me(ent.host, token)).status).toBe(401);
  });

  it("refuses an enterprise token on a standard tenant's host", async () => {
    const token = await t.enterpriseToken(ent, t.newUser(), ['owner']);
    expect((await me(standard.host, token)).status).toBe(401);
  });

  it('refuses a token for another audience', async () => {
    const token = await t.enterpriseToken(ent, t.newUser(), ['owner'], { aud: 'account' });
    expect((await me(ent.host, token)).status).toBe(401);
  });

  it("refuses a token issued to a customer's app, even with every other claim right", async () => {
    const token = await t.enterpriseToken(ent, t.newUser(), ['owner'], { azp: 'app-1a2b3c4d' });
    expect((await me(ent.host, token)).status).toBe(401);
  });

  it('accepts tokens issued to our portal, and says the workspace is enterprise', async () => {
    const token = await t.enterpriseToken(ent, t.newUser(), ['member'], { azp: 'tenantry-portal' });
    const res = await t.request<{ tenant: { tier: string } }>({ host: ent.host, path: '/api/me', token });
    expect(res.status).toBe(200);
    expect(res.body.tenant.tier).toBe('enterprise');
    const { token: std } = await t.member(standard, 'members');
    const stdMe = await t.request<{ tenant: { tier: string } }>({
      host: standard.host,
      path: '/api/me',
      token: std,
    });
    expect(stdMe.body.tenant.tier).toBe('standard');
  });

  it('ignores roles outside tenantry-api', async () => {
    const token = await t.enterpriseToken(ent, t.newUser(), [], {
      realm_access: { roles: ['owner'] },
      resource_access: { 'customer-app': { roles: ['owner'] } },
    });
    expect((await me(ent.host, token)).status).toBe(403);
  });
});

describe('identity refresh', () => {
  it('creates no user for someone who is not a member', async () => {
    const user = t.newUser();
    expect((await me(ent.host, await t.enterpriseToken(ent, user, []))).status).toBe(403);
    const ids = await platformRepository(t.db).userIdsForSubjects(ent.issuer, [user.sub]);
    expect(ids.size).toBe(0);
  });

  it('updates the email and name the token carries', async () => {
    const user = t.newUser();
    await me(ent.host, await t.enterpriseToken(ent, user, ['member'], { name: 'Old Name' }));
    const res = await me(
      ent.host,
      await t.enterpriseToken(ent, { ...user, email: 'renamed@example.com' }, ['member'], {
        name: 'New Name',
      }),
    );
    expect(res.body.user.email).toBe('renamed@example.com');
    const [row] = await platformRepository(t.db)
      .usersByIds([res.body.user.id])
      .then((m) => [...m.values()]);
    expect(row).toEqual({ email: 'renamed@example.com', displayName: 'New Name' });
  });
});

describe('operator-only routes', () => {
  it('accept the operator scripts on the base domain', async () => {
    const res = await t.request<{ operator: { clientId: string } }>({
      host: t.apexHost,
      path: '/api/platform/probe',
      token: await t.operatorToken(),
    });
    expect(res.status).toBe(200);
    expect(res.body.operator).toEqual({ clientId: 'tenantry-ops' });
  });

  it("refuse a person's token", async () => {
    const res = await t.request({
      host: t.apexHost,
      path: '/api/platform/probe',
      token: await t.token(t.newUser()),
    });
    expect(res.status).toBe(403);
  });

  it('refuse no token, and any tenant host', async () => {
    expect((await t.request({ host: t.apexHost, path: '/api/platform/probe' })).status).toBe(401);
    const res = await t.request({
      host: ent.host,
      path: '/api/platform/probe',
      token: await t.operatorToken(),
    });
    expect(res.status).toBe(404);
  });

  it('refuse an operator token from an enterprise realm', async () => {
    const res = await t.request({
      host: t.apexHost,
      path: '/api/platform/probe',
      token: await t.operatorToken({ iss: ent.issuer }),
    });
    expect(res.status).toBe(401);
  });
});
