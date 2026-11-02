import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { auditLog, projects } from '../src/schema/index.js';
import { tenantTx } from '../src/tenant-tx.js';
import { connect, failure, seedProject, seedTenant, type SeededTenant } from './fixtures.js';

const conn = connect();
let a: SeededTenant;
let b: SeededTenant;
let aProject: string;
let bProject: string;

beforeAll(async () => {
  a = await seedTenant(conn.owner);
  b = await seedTenant(conn.owner);
  aProject = await seedProject(conn.owner, a, 'A project');
  bProject = await seedProject(conn.owner, b, 'B project');
});
afterAll(() => conn.close());

describe('guarantee: a query that forgets the tenant filter', () => {
  it('returns only the current tenant rows', async () => {
    const rows = await tenantTx(conn.db, a.tenantId, (tx) => tx.select().from(projects));
    expect(rows.map((r) => r.id)).toEqual([aProject]);
  });

  it('finds nothing when looking up another tenant row by id', async () => {
    const rows = await tenantTx(conn.db, a.tenantId, (tx) =>
      tx.select().from(projects).where(eq(projects.id, bProject)),
    );
    expect(rows).toEqual([]);
  });

  it('sees nothing when no tenant is set', async () => {
    expect(await conn.db.select().from(projects)).toEqual([]);
  });

  it('refuses an insert for another tenant', async () => {
    const reason = await failure(
      tenantTx(conn.db, a.tenantId, (tx) =>
        tx.insert(projects).values({ tenantId: b.tenantId, name: 'sneaky', ownerUserId: a.userId }),
      ),
    );
    expect(reason).toMatch(/row-level security/);
  });

  it('fills the tenant id from the transaction', async () => {
    const [row] = await tenantTx(conn.db, a.tenantId, (tx) =>
      tx.insert(projects).values({ name: 'defaulted', ownerUserId: a.userId }).returning(),
    );
    expect(row?.tenantId).toBe(a.tenantId);
  });

  it('clears the setting after the transaction', async () => {
    await tenantTx(conn.db, a.tenantId, () => Promise.resolve());
    const clients = await Promise.all([conn.app.connect(), conn.app.connect()]);
    try {
      for (const client of clients) {
        const r = await client.query<{ v: string | null }>(
          `select current_setting('app.tenant_id', true) as v`,
        );
        expect(r.rows[0]?.v ?? '').toBe('');
      }
    } finally {
      for (const client of clients) client.release();
    }
  });
});

describe('guarantee: the app role cannot bypass row-level security', () => {
  const asApp = async (statement: string) => {
    const client = await conn.app.connect();
    try {
      await client.query('begin');
      await client.query(statement);
      await client.query('select * from projects');
    } finally {
      await client.query('rollback');
      client.release();
    }
  };

  it('cannot turn row security off', async () => {
    await expect(asApp('set local row_security = off')).rejects.toThrow(/row-level security/);
  });

  it('cannot disable row-level security on a table', async () => {
    await expect(asApp('alter table projects disable row level security')).rejects.toThrow(/must be owner/);
  });

  it('cannot become the owner role', async () => {
    await expect(asApp('set role tenantry_owner')).rejects.toThrow(/permission denied/);
  });
});

describe('audit log', () => {
  it('is append-only for the app role', async () => {
    await tenantTx(conn.db, a.tenantId, (tx) =>
      tx.insert(auditLog).values({ actorUserId: a.userId, action: 'test.event', target: 'x' }),
    );
    const inTenant = (fn: Parameters<typeof tenantTx>[2]) => failure(tenantTx(conn.db, a.tenantId, fn));
    expect(await inTenant((tx) => tx.update(auditLog).set({ action: 'changed' }))).toMatch(
      /permission denied/,
    );
    expect(await inTenant((tx) => tx.delete(auditLog))).toMatch(/permission denied/);
    expect(await inTenant((tx) => tx.execute(sql`truncate audit_log`))).toMatch(/permission denied/);
  });
});
