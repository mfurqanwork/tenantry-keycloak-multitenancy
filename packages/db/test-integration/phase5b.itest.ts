import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { grantConsole, listConsole, revokeConsole } from '../src/repositories/console-access.js';
import {
  cutOver,
  getMigration,
  markAborted,
  markCutOver,
  markFinished,
  startMigration,
} from '../src/repositories/migrations.js';
import { platformRepository } from '../src/repositories/platform.js';
import { tenantConsoleAccess, tenantMigrations, tenants } from '../src/schema/index.js';
import { tenantTx } from '../src/tenant-tx.js';
import { connect, failure, seedTenant, type SeededTenant } from './fixtures.js';
import { eq } from 'drizzle-orm';

const conn = connect();
let a: SeededTenant;
let b: SeededTenant;

beforeAll(async () => {
  a = await seedTenant(conn.owner);
  b = await seedTenant(conn.owner);
  await tenantTx(conn.db, a.tenantId, async (tx) => {
    await startMigration(tx, { fromOrgId: 'org-a', realm: 'ent-a' });
    await grantConsole(tx, { userId: a.userId, grantedBy: a.userId });
  });
});
afterAll(() => conn.close());

describe('guarantee: phase 5b tenant tables are isolated', () => {
  it.each([
    ['tenant_migrations', tenantMigrations],
    ['tenant_console_access', tenantConsoleAccess],
  ] as const)('%s shows another tenant nothing, and nothing without a tenant', async (_name, table) => {
    expect(await tenantTx(conn.db, b.tenantId, (tx) => tx.select().from(table))).toEqual([]);
    expect(await conn.db.select().from(table)).toEqual([]);
  });

  it('refuses a console grant written for another tenant', async () => {
    const reason = await failure(
      tenantTx(conn.db, a.tenantId, (tx) =>
        tx
          .insert(tenantConsoleAccess)
          .values({ tenantId: b.tenantId, userId: b.userId, grantedBy: b.userId }),
      ),
    );
    expect(reason).toMatch(/row-level security/);
  });
});

describe('migration record', () => {
  it('starts once, then records the cut-over, the finish or the abort', async () => {
    const t = await seedTenant(conn.owner);
    await tenantTx(conn.db, t.tenantId, async (tx) => {
      expect(await getMigration(tx)).toBeNull();
      const first = await startMigration(tx, { fromOrgId: 'org-1', realm: 'ent-x' });
      const again = await startMigration(tx, { fromOrgId: 'org-other', realm: 'ent-other' });
      expect(again).toEqual(first);
      expect(first).toMatchObject({ fromOrgId: 'org-1', realm: 'ent-x', cutOverAt: null, finishedAt: null });
      await markCutOver(tx);
      await markFinished(tx);
      const done = await getMigration(tx);
      expect(done?.cutOverAt).toBeInstanceOf(Date);
      expect(done?.finishedAt).toBeInstanceOf(Date);
    });
    const u = await seedTenant(conn.owner);
    await tenantTx(conn.db, u.tenantId, async (tx) => {
      await startMigration(tx, { fromOrgId: 'org-2', realm: 'ent-y' });
      await markAborted(tx);
      expect((await getMigration(tx))?.abortedAt).toBeInstanceOf(Date);
    });
  });
});

describe('console access', () => {
  it('grants once, lists, and revokes', async () => {
    const t = await seedTenant(conn.owner);
    await tenantTx(conn.db, t.tenantId, async (tx) => {
      expect(await grantConsole(tx, { userId: t.userId, grantedBy: t.userId })).toBe(true);
      expect(await grantConsole(tx, { userId: t.userId, grantedBy: t.userId })).toBe(false);
      expect(await listConsole(tx)).toEqual([t.userId]);
      expect(await revokeConsole(tx, t.userId)).toBe(true);
      expect(await revokeConsole(tx, t.userId)).toBe(false);
      expect(await listConsole(tx)).toEqual([]);
    });
  });
});

describe('tenant status and the cut-over', () => {
  it('accepts migrating and refuses anything unknown', async () => {
    const t = await seedTenant(conn.owner);
    await platformRepository(conn.db).setTenantStatus(t.tenantId, 'migrating');
    expect((await platformRepository(conn.db).findTenantById(t.tenantId))?.status).toBe('migrating');
    const reason = await failure(
      conn.owner.query('update tenants set status = $1 where id = $2', ['moving', t.tenantId]),
    );
    expect(reason).toMatch(/tenants_status/);
  });

  it('moves a Standard tenant to its own realm in one step', async () => {
    const t = await seedTenant(conn.owner);
    const platform = platformRepository(conn.db);
    const realm = `ent-${randomUUID().slice(0, 8)}`;
    await platform.setTenantStatus(t.tenantId, 'migrating');
    await platform.cutOverToEnterprise(t.tenantId, {
      realm,
      issuer: `http://auth.test/realms/${realm}`,
      templateVersion: 4,
    });
    const after = await platform.findTenantById(t.tenantId);
    expect(after).toMatchObject({
      tier: 'enterprise',
      status: 'active',
      realm,
      issuer: `http://auth.test/realms/${realm}`,
      kcOrgId: null,
      templateVersion: 4,
    });
    const [row] = await conn.db
      .select({ tier: tenants.tier })
      .from(tenants)
      .where(eq(tenants.id, t.tenantId));
    expect(row?.tier).toBe('enterprise');
  });
});

describe('a second identity for the same person', () => {
  it('points the new issuer at the same user, once, and refuses someone else', async () => {
    const t = await seedTenant(conn.owner);
    const platform = platformRepository(conn.db);
    const subject = randomUUID();
    const input = { userId: t.userId, issuer: 'http://auth.test/realms/ent-moved', subject };
    expect(await platform.addIdentity(input)).toBe(true);
    expect(await platform.addIdentity(input)).toBe(true);
    expect((await platform.userIdsForSubjects(input.issuer, [subject])).get(subject)).toBe(t.userId);
    const other = await seedTenant(conn.owner);
    expect(await platform.addIdentity({ ...input, userId: other.userId })).toBe(false);
  });
});

describe('the cut-over', () => {
  it('is all or nothing: a failure after it, in the same transaction, leaves the tenant Standard', async () => {
    const t = await seedTenant(conn.owner);
    const platform = platformRepository(conn.db);
    const before = await platform.findTenantById(t.tenantId);
    await tenantTx(conn.db, t.tenantId, (tx) => startMigration(tx, { fromOrgId: 'org-x', realm: 'ent-x' }));
    const failed = await failure(
      tenantTx(conn.db, t.tenantId, async (tx) => {
        await cutOver(tx, t.tenantId, { realm: 'ent-x', issuer: 'http://auth.test/realms/ent-x', templateVersion: 4 });
        throw new Error('the audit entry could not be written');
      }),
    );
    expect(failed).toMatch(/audit entry/);
    expect(await platform.findTenantById(t.tenantId)).toEqual(before);
    expect((await tenantTx(conn.db, t.tenantId, (tx) => getMigration(tx)))?.cutOverAt).toBeNull();
    await tenantTx(conn.db, t.tenantId, (tx) =>
      cutOver(tx, t.tenantId, { realm: 'ent-x', issuer: 'http://auth.test/realms/ent-x', templateVersion: 4 }),
    );
    expect(await platform.findTenantById(t.tenantId)).toMatchObject({ tier: 'enterprise', realm: 'ent-x', kcOrgId: null });
    expect((await tenantTx(conn.db, t.tenantId, (tx) => getMigration(tx)))?.cutOverAt).toBeInstanceOf(Date);
  });
});
