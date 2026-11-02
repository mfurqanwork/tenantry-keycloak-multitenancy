import { Controller, Get, Post } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant, type TestUser } from '../testing/test-app.js';
import { Ctx, Public, RequirePermission, SignedIn, SignedInOnly } from './decorators.js';
import type { SignedInUser } from './request-context.js';

@Controller('probe')
class ProbeController {
  @Get('context')
  context(@Ctx() ctx: TenantContext) {
    return { tenantId: ctx.tenantId, userId: ctx.userId, roles: ctx.roles };
  }

  @Post('invite')
  @RequirePermission('members:invite')
  invite() {
    return { ok: true };
  }

  @Get('public')
  @Public()
  open() {
    return { ok: true };
  }

  @Get('signed-in')
  @SignedInOnly()
  signedIn(@SignedIn() user: SignedInUser) {
    return { userId: user.userId };
  }
}

let t: TestApp;
let acme: TestTenant;
let other: TestTenant;
let admin: TestUser;
let member: TestUser;

beforeAll(async () => {
  t = await createTestApp({ controllers: [ProbeController] });
  acme = await t.seedTenant();
  other = await t.seedTenant();
  admin = t.newUser();
  member = t.newUser();
  await t.join(acme, admin, 'admins');
  await t.join(acme, member, 'members');
});
afterAll(() => t.close());

const adminToken = () => t.token(admin, { alias: acme.slug, groups: ['/admins'] });

describe('TenantAuthGuard', () => {
  it('answers 404 for an unknown tenant', async () => {
    const res = await t.request({ host: 'nobody.tenantry.localhost', path: '/api/probe/context' });
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  });

  it('answers 404 on the apex host for a tenant route', async () => {
    expect(
      (await t.request({ host: t.apexHost, path: '/api/probe/context', token: await adminToken() })).status,
    ).toBe(404);
  });

  it('answers 401 without a token', async () => {
    expect((await t.request({ host: acme.host, path: '/api/probe/context' })).status).toBe(401);
  });

  it('answers 401 for a token from another issuer', async () => {
    const token = await t.token(
      admin,
      { alias: acme.slug, groups: ['/admins'] },
      { iss: 'http://elsewhere/realms/x' },
    );
    expect((await t.request({ host: acme.host, path: '/api/probe/context', token })).status).toBe(401);
  });

  it("answers 403 for a token without this tenant's organization", async () => {
    const token = await t.token(admin, { alias: other.slug, groups: ['/owners'] });
    expect((await t.request({ host: acme.host, path: '/api/probe/context', token })).status).toBe(403);
  });

  it('answers 403 when the role lacks the permission', async () => {
    const token = await t.token(member, { alias: acme.slug, groups: ['/members'] });
    expect(
      (await t.request({ host: acme.host, method: 'POST', path: '/api/probe/invite', token })).status,
    ).toBe(403);
  });

  it('lets an admin through with the host tenant in the context', async () => {
    const res = await t.request<{ tenantId: string; roles: string[] }>({
      host: acme.host,
      path: '/api/probe/context',
      token: await adminToken(),
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tenantId: acme.id, roles: ['admin'] });
    const invite = await t.request({
      host: acme.host,
      method: 'POST',
      path: '/api/probe/invite',
      token: await adminToken(),
    });
    expect(invite.status).toBe(201);
  });

  it('gives the same user id on every request', async () => {
    const first = await t.request<{ userId: string }>({
      host: acme.host,
      path: '/api/probe/context',
      token: await adminToken(),
    });
    const second = await t.request<{ userId: string }>({
      host: acme.host,
      path: '/api/probe/context',
      token: await adminToken(),
    });
    expect(second.body.userId).toBe(first.body.userId);
  });

  it('ignores a tenant id sent by the client', async () => {
    const res = await t.request<{ tenantId: string }>({
      host: acme.host,
      path: '/api/probe/context',
      token: await adminToken(),
      headers: { 'x-tenant-id': other.id },
    });
    expect(res.body.tenantId).toBe(acme.id);
  });

  it('lets anyone reach a public route', async () => {
    expect((await t.request({ host: 'anything.tenantry.localhost', path: '/api/probe/public' })).status).toBe(
      200,
    );
  });

  it('lets a signed-in user reach a signed-in-only route on the apex host', async () => {
    const res = await t.request<{ userId: string }>({
      host: t.apexHost,
      path: '/api/probe/signed-in',
      token: await t.token(t.newUser()),
    });
    expect(res.status).toBe(200);
    expect(res.body.userId).toMatch(/[0-9a-f-]{36}/);
  });

  it('keeps signed-in-only routes off tenant hosts and away from anonymous callers', async () => {
    expect(
      (await t.request({ host: acme.host, path: '/api/probe/signed-in', token: await adminToken() })).status,
    ).toBe(404);
    expect((await t.request({ host: t.apexHost, path: '/api/probe/signed-in' })).status).toBe(401);
  });
});
