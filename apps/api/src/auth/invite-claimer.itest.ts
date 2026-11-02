import { createInvite, listAudit, tenantTx } from '@tenantry/db';
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
