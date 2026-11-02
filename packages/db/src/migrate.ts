import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const MIGRATIONS = fileURLToPath(new URL('../migrations', import.meta.url));

// Runs as tenantry_owner: the only role allowed to change the schema.
export async function runMigrations(ownerUrl: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: ownerUrl, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });
  } finally {
    await pool.end();
  }
}
