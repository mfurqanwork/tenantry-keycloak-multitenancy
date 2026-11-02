import pg from 'pg';
import { runMigrations } from '../src/migrate.js';
import { integrationEnv } from './env.js';

export default async function setup(): Promise<void> {
  const { ownerUrl } = integrationEnv();
  const probe = new pg.Client({ connectionString: ownerUrl, connectionTimeoutMillis: 3000 });
  try {
    await probe.connect();
  } catch {
    const shown = ownerUrl.replace(/:[^:@/]*@/, ':***@');
    throw new Error(`Postgres not reachable at ${shown}: start it with pnpm dev:infra`);
  } finally {
    await probe.end().catch(() => undefined);
  }
  await runMigrations(ownerUrl);
}
