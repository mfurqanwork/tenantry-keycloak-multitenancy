import { createInvite, listAudit, revokeInvite, tenantTx } from '@tenantry/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant } from '../testing/test-app.js';
import { Controller, Get } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import { Ctx } from './decorators.js';

@Controller('probe')
class ProbeController {
  @Get('context')
  context(@Ctx() ctx: TenantContext) {
    return { roles: ctx.roles };
  }
}

let t: TestApp;
let acme: TestTenant;
let inviterId: string;

beforeAll(async () => {
  t = await createTestApp({ controllers: [ProbeController] });
  acme = await t.seedTenant();
  // The inviter must exist as a user: sign them in once.
  const owner = t.newUser();
  await t.join(acme, owner, 'owners');
  const res = await t.request<{ roles: string[] }>({
    host: acme.host,
    path: '/api/probe/context',
    token: await t.token(owner, { alias: acme.slug, groups: ['/owners'] }),
  });
  expect(res.status).toBe(200);
  const [entry] = await t.db
    .execute<{ user_id: string }>(`select user_id from identities where subject = '${owner.sub}'`)
    .then((r) => r.rows);
  inviterId = entry?.user_id ?? '';
});
afterAll(() => t.close());

describe('invite claimer (first request of an invited member)', () => {
  it('applies the invited role, records it and audits member.joined', async () => {
    const bob = t.newUser();
    await tenantTx(t.db, acme.id, (tx) =>
      createInvite(tx, { email: bob.email.toUpperCase(), role: 'admin', invitedBy: inviterId }),
    );
    await t.join(acme, bob, null);

    const res = await t.request<{ roles: string[] }>({
      host: acme.host,
      path: '/api/probe/context',
      token: await t.token(bob, { alias: acme.slug, groups: [] }),
    });
    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual(['admin']);
    const listed = await t.directory.listMembers(acme.kcOrgId);
    expect(listed.find((m) => m.kcUserId === bob.sub)?.group).toBe('admins');
    const audit = await tenantTx(t.db, acme.id, (tx) => listAudit(tx, { limit: 5 }));
    expect(audit.some((e) => e.action === 'member.joined')).toBe(true);

    // The invite is used up: a second claim finds nothing to apply.
    await t.directory.setMemberGroup(acme.kcOrgId, bob.sub, 'members');
    await t.directory.removeMember(acme.kcOrgId, bob.sub);
    await t.join(acme, bob, null);
    const again = await t.request({
      host: acme.host,
      path: '/api/probe/context',
      token: await t.token(bob, { alias: acme.slug, groups: [] }),
    });
    expect(again.status).toBe(403);
  });

  const firstRequest = async (user: { sub: string; email: string }, extra?: Record<string, unknown>) =>
    t.request<{ roles: string[] }>({
      host: acme.host,
      path: '/api/probe/context',
      token: await t.token(user, { alias: acme.slug, groups: [] }, extra),
    });
  const invite = (email: string) =>
    tenantTx(t.db, acme.id, (tx) => createInvite(tx, { email, role: 'admin', invitedBy: inviterId }));
  const joins = async () =>
    (await tenantTx(t.db, acme.id, (tx) => listAudit(tx, { limit: 50 }))).filter(
      (e) => e.action === 'member.joined',
    );

  it('keeps the role on later requests whose token still shows no group', async () => {
    const dana = t.newUser();
    await invite(dana.email);
    await t.join(acme, dana, null);
    expect((await firstRequest(dana)).body.roles).toEqual(['admin']);
    // The token lives five minutes and still says groups: []; the role must hold for that time.
    const later = await firstRequest(dana);
    expect(later.status).toBe(200);
    expect(later.body.roles).toEqual(['admin']);
  });

  it('applies an invite once when the first requests arrive together', async () => {
    const erin = t.newUser();
    await invite(erin.email);
    await t.join(acme, erin, null);
    const before = (await joins()).length;
    const results = await Promise.all([firstRequest(erin), firstRequest(erin), firstRequest(erin)]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect((await joins()).length).toBe(before + 1);
  });

  it('does not claim an invite for an unverified email', async () => {
    const frank = t.newUser();
    await invite(frank.email);
    await t.join(acme, frank, null);
    expect((await firstRequest(frank, { email_verified: false })).status).toBe(403);
    expect(
      (await t.directory.listMembers(acme.kcOrgId)).find((m) => m.kcUserId === frank.sub)?.group,
    ).toBeNull();
  });

  it('takes someone who joined through a revoked invite back out of the workspace', async () => {
    const gina = t.newUser();
    const created = await invite(gina.email);
    await tenantTx(t.db, acme.id, (tx) => revokeInvite(tx, created.id));
    await t.join(acme, gina, null);
    expect((await firstRequest(gina)).status).toBe(403);
    expect((await t.directory.listMembers(acme.kcOrgId)).some((m) => m.kcUserId === gina.sub)).toBe(false);
  });

  it('answers 403 for a member with no group and no invite, writing nothing', async () => {
    const carol = t.newUser();
    await t.join(acme, carol, null);
    const before = await tenantTx(t.db, acme.id, (tx) => listAudit(tx, { limit: 50 }));
    const res = await t.request({
      host: acme.host,
      path: '/api/probe/context',
      token: await t.token(carol, { alias: acme.slug, groups: [] }),
    });
    expect(res.status).toBe(403);
    const after = await tenantTx(t.db, acme.id, (tx) => listAudit(tx, { limit: 50 }));
    expect(after).toHaveLength(before.length);
  });
});
