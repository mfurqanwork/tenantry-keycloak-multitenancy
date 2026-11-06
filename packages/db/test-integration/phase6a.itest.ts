import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createInvite, markInviteAccepted, revokeInvite } from '../src/repositories/invites.js';
import { getReadUntil, markRead, openInvitesForEmail } from '../src/repositories/notifications.js';
import { platformRepository } from '../src/repositories/platform.js';
import { notificationReads } from '../src/schema/index.js';
import { tenantTx } from '../src/tenant-tx.js';
import { connect, seedTenant, type SeededTenant } from './fixtures.js';

const conn = connect();
let a: SeededTenant;
let b: SeededTenant;

beforeAll(async () => {
  a = await seedTenant(conn.owner);
  b = await seedTenant(conn.owner);
});
afterAll(() => conn.close());

describe('guarantee: notification_reads is isolated', () => {
  it('shows another tenant nothing, and nothing without a tenant', async () => {
    await tenantTx(conn.db, a.tenantId, (tx) => markRead(tx, a.userId, new Date()));
    expect(await tenantTx(conn.db, b.tenantId, (tx) => tx.select().from(notificationReads))).toEqual([]);
    expect(await conn.db.select().from(notificationReads)).toEqual([]);
  });
});

describe('notification reads', () => {
  it('keeps the latest "read up to" time per person', async () => {
    const t = await seedTenant(conn.owner);
    expect(await tenantTx(conn.db, t.tenantId, (tx) => getReadUntil(tx, t.userId))).toBeNull();
    const first = new Date('2026-11-08T10:00:00Z');
    const later = new Date('2026-11-08T11:00:00Z');
    await tenantTx(conn.db, t.tenantId, (tx) => markRead(tx, t.userId, later));
    await tenantTx(conn.db, t.tenantId, (tx) => markRead(tx, t.userId, first));
    expect(await tenantTx(conn.db, t.tenantId, (tx) => getReadUntil(tx, t.userId))).toEqual(later);
  });
});

describe('guarantee: open invites by email (ADR-0028)', () => {
  it("finds another workspace's open invite to exactly that address, and nothing else", async () => {
    const email = `dora-${randomUUID().slice(0, 8)}@x.test`;
    const open = await tenantTx(conn.db, a.tenantId, (tx) =>
      createInvite(tx, { email, role: 'admin', invitedBy: a.userId }),
    );
    expect(await openInvitesForEmail(conn.db, email.toUpperCase())).toEqual([
      { slug: a.slug, name: a.slug, role: 'admin', invitedAt: expect.any(Date) as Date },
    ]);
    expect(await openInvitesForEmail(conn.db, `other-${email}`)).toEqual([]);
    // Only these: no ids, no emails, no who invited.
    expect(Object.keys((await openInvitesForEmail(conn.db, email))[0] ?? {}).sort()).toEqual([
      'invitedAt',
      'name',
      'role',
      'slug',
    ]);
    await tenantTx(conn.db, a.tenantId, (tx) => revokeInvite(tx, open.id));
    expect(await openInvitesForEmail(conn.db, email)).toEqual([]);
  });

  it('leaves out accepted invites, and workspaces that are not active', async () => {
    const email = `erin-${randomUUID().slice(0, 8)}@x.test`;
    const accepted = await tenantTx(conn.db, b.tenantId, (tx) =>
      createInvite(tx, { email, role: 'member', invitedBy: b.userId }),
    );
    await tenantTx(conn.db, b.tenantId, (tx) => markInviteAccepted(tx, accepted.id));
    expect(await openInvitesForEmail(conn.db, email)).toEqual([]);
    const paused = await seedTenant(conn.owner);
    await tenantTx(conn.db, paused.tenantId, (tx) =>
      createInvite(tx, { email, role: 'member', invitedBy: paused.userId }),
    );
    await platformRepository(conn.db).setTenantStatus(paused.tenantId, 'migrating');
    expect(await openInvitesForEmail(conn.db, email)).toEqual([]);
  });
});
