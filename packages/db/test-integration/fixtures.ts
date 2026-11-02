import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createDb, type Db } from '../src/db.js';
import { integrationEnv } from './env.js';

// Seeding inserts always return a row; fail loudly if one does not.
function only<T>(rows: T[]): T {
  const [row] = rows;
  if (row === undefined) throw new Error('expected one row');
  return row;
}

export interface Connection {
  app: pg.Pool;
  owner: pg.Pool;
  db: Db;
  close(): Promise<void>;
}

// Owner-side seeding only; every assertion runs as the app role.
export function connect(): Connection {
  const { appUrl, ownerUrl } = integrationEnv();
  const app = new pg.Pool({ connectionString: appUrl, max: 2 });
  const owner = new pg.Pool({ connectionString: ownerUrl, max: 1 });
  return {
    app,
    owner,
    db: createDb(app),
    close: async () => {
      await Promise.all([app.end(), owner.end()]);
    },
  };
}

export interface SeededTenant {
  tenantId: string;
  userId: string;
  slug: string;
}

export async function seedTenant(owner: pg.Pool): Promise<SeededTenant> {
  const slug = `t${randomUUID().slice(0, 8)}`;
  const tenant = await owner.query<{ id: string }>(
    `insert into tenants (slug, name, status) values ($1, $1, 'active') returning id`,
    [slug],
  );
  const user = await owner.query<{ id: string }>(`insert into users (email) values ($1) returning id`, [
    `${slug}@example.com`,
  ]);
  return { tenantId: only(tenant.rows).id, userId: only(user.rows).id, slug };
}

// FORCE row-level security binds the owner too, so seeding sets the tenant like the app does.
export async function asTenant<T>(
  owner: pg.Pool,
  tenantId: string,
  fn: (c: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await owner.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('app.tenant_id', $1, true)`, [tenantId]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function seedProject(owner: pg.Pool, t: SeededTenant, name: string): Promise<string> {
  return asTenant(owner, t.tenantId, async (c) => {
    const r = await c.query<{ id: string }>(
      `insert into projects (name, owner_user_id) values ($1, $2) returning id`,
      [name, t.userId],
    );
    return only(r.rows).id;
  });
}

// Drizzle wraps driver errors as "Failed query: ..."; the Postgres reason is in cause.
export async function failure(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    const e = err as Error & { cause?: { message?: string } };
    return `${e.message} | ${e.cause?.message ?? ''}`;
  }
  throw new Error('expected the operation to fail');
}
