import pg from 'pg';

// The API's pool. It must connect as tenantry_app, which owns nothing and cannot bypass RLS (ADR-0006).
export function createAppPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl });
}

export async function pingDatabase(pool: pg.Pool): Promise<void> {
  await pool.query('select 1');
}
