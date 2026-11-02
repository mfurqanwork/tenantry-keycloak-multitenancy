import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OpenInviteExistsError, SlugTakenError } from '../src/errors.js';
import { insertAudit, listAudit } from '../src/repositories/audit.js';
import {
  createInvite,
  findOpenInviteByEmail,
  hasRevokedInvite,
  revokeInvite,
} from '../src/repositories/invites.js';
import { lockTenantMembership } from '../src/repositories/membership-lock.js';
import { platformRepository } from '../src/repositories/platform.js';
import { createProject, getProject } from '../src/repositories/projects.js';
import { tenantTx } from '../src/tenant-tx.js';
import { connect, seedTenant, type SeededTenant } from './fixtures.js';

const conn = connect();
const platform = platformRepository(conn.db);
const newSlug = () => `r${randomUUID().slice(0, 8)}`;
let a: SeededTenant;
let b: SeededTenant;

beforeAll(async () => {
  a = await seedTenant(conn.owner);
  b = await seedTenant(conn.owner);
});
afterAll(() => conn.close());

describe('platformRepository: tenants', () => {
  it('reuses a slug whose signup has been stuck in provisioning for over ten minutes', async () => {
    const slug = newSlug();
    const stuck = await platform.insertProvisioningTenant({ slug, name: 'Crashed' });
    await conn.owner.query(`update tenants set created_at = now() - interval '11 minutes' where id = $1`, [
      stuck.id,
    ]);
    const again = await platform.insertProvisioningTenant({ slug, name: 'Again' });
    expect(again.id).not.toBe(stuck.id);
  });

  it('serialises membership changes per tenant', async () => {
    const order: string[] = [];
    const hold = (label: string, ms: number) =>
      tenantTx(conn.db, a.tenantId, async (tx) => {
        await lockTenantMembership(tx);
        order.push(`${label}:start`);
        await new Promise((r) => setTimeout(r, ms));
        order.push(`${label}:end`);
      });
    await Promise.all([
      hold('first', 150),
      new Promise((r) => setTimeout(r, 20)).then(() => hold('second', 0)),
    ]);
    expect(order).toEqual(['first:start', 'first:end', 'second:start', 'second:end']);
  });

  it('refuses a slug held by a provisioning or active tenant, and reuses a failed one', async () => {
    const slug = newSlug();
    const first = await platform.insertProvisioningTenant({ slug, name: 'One' });
    await expect(platform.insertProvisioningTenant({ slug, name: 'Two' })).rejects.toBeInstanceOf(
      SlugTakenError,
    );
    await platform.markTenantFailed(first.id);
    const third = await platform.insertProvisioningTenant({ slug, name: 'Three' });
    expect(third.id).not.toBe(first.id);
    expect((await platform.findTenantBySlug(slug))?.name).toBe('Three');
  });

  it('lets exactly one of two concurrent signups for a slug win', async () => {
    const slug = newSlug();
    const results = await Promise.allSettled([
      platform.insertProvisioningTenant({ slug, name: 'A' }),
      platform.insertProvisioningTenant({ slug, name: 'B' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(SlugTakenError);
  });

  it('returns the identity fields once a tenant is active', async () => {
    const slug = newSlug();
    const { id } = await platform.insertProvisioningTenant({ slug, name: 'Active' });
    await platform.activateTenant(id, { realm: 'platform', issuer: 'http://issuer', kcOrgId: 'org-1' });
    expect(await platform.findTenantBySlug(slug)).toEqual({
      id,
      slug,
      name: 'Active',
      status: 'active',
      realm: 'platform',
      issuer: 'http://issuer',
      kcOrgId: 'org-1',
    });
    expect((await platform.findTenantById(id))?.slug).toBe(slug);
  });
});

describe('platformRepository: identities', () => {
  it('maps the same issuer and subject to the same user', async () => {
    const subject = randomUUID();
    const one = await platform.upsertIdentity({
      issuer: 'iss-1',
      subject,
      email: 'x@example.com',
      displayName: 'X',
    });
    const two = await platform.upsertIdentity({
      issuer: 'iss-1',
      subject,
      email: 'x@example.com',
      displayName: 'X',
    });
    const other = await platform.upsertIdentity({ issuer: 'iss-2', subject, email: null, displayName: null });
    expect(two.userId).toBe(one.userId);
    expect(other.userId).not.toBe(one.userId);
    expect(await platform.subjectForUser(one.userId, 'iss-1')).toBe(subject);
    expect((await platform.userIdsForSubjects('iss-1', [subject])).get(subject)).toBe(one.userId);
    expect((await platform.usersByIds([one.userId])).get(one.userId)).toEqual({
      email: 'x@example.com',
      displayName: 'X',
    });
  });
});

describe('invites', () => {
  it('allows one open invite per email, case-insensitively', async () => {
    await tenantTx(conn.db, a.tenantId, async (tx) => {
      const invite = await createInvite(tx, { email: 'bob@example.com', role: 'admin', invitedBy: a.userId });
      await expect(
        createInvite(tx, { email: 'Bob@Example.com', role: 'member', invitedBy: a.userId }),
      ).rejects.toBeInstanceOf(OpenInviteExistsError);
      expect((await findOpenInviteByEmail(tx, 'BOB@example.com'))?.id).toBe(invite.id);
    });
  });

  it('allows a new invite after the open one is revoked', async () => {
    await tenantTx(conn.db, b.tenantId, async (tx) => {
      const invite = await createInvite(tx, {
        email: 'carol@example.com',
        role: 'member',
        invitedBy: b.userId,
      });
      expect(await hasRevokedInvite(tx, 'CAROL@example.com')).toBe(false);
      expect(await revokeInvite(tx, invite.id)).toBe(true);
      expect(await hasRevokedInvite(tx, 'CAROL@example.com')).toBe(true);
      expect(await revokeInvite(tx, invite.id)).toBe(false);
      await expect(
        createInvite(tx, { email: 'carol@example.com', role: 'member', invitedBy: b.userId }),
      ).resolves.toMatchObject({ email: 'carol@example.com' });
    });
  });
});

describe('projects', () => {
  it("does not find another tenant's project", async () => {
    const project = await tenantTx(conn.db, b.tenantId, (tx) =>
      createProject(tx, { name: 'B only', ownerUserId: b.userId }),
    );
    expect(await tenantTx(conn.db, a.tenantId, (tx) => getProject(tx, project.id))).toBeNull();
    expect((await tenantTx(conn.db, b.tenantId, (tx) => getProject(tx, project.id)))?.name).toBe('B only');
  });
});

describe('audit', () => {
  it('pages newest first', async () => {
    const t = await seedTenant(conn.owner);
    await tenantTx(conn.db, t.tenantId, async (tx) => {
      for (const action of ['one', 'two', 'three']) {
        await insertAudit(tx, { actorUserId: t.userId, action: `test.${action}`, target: 'x' });
      }
    });
    const page = await tenantTx(conn.db, t.tenantId, (tx) => listAudit(tx, { limit: 2 }));
    expect(page.map((e) => e.action)).toEqual(['test.three', 'test.two']);
    const next = await tenantTx(conn.db, t.tenantId, (tx) =>
      listAudit(tx, { before: page[1]?.id, limit: 2 }),
    );
    expect(next.map((e) => e.action)).toEqual(['test.one']);
  });
});
