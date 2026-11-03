import { runMigrations } from '@tenantry/db';
import { stackEnv } from './fixtures.js';

export default async function setup(): Promise<void> {
  try {
    await runMigrations(stackEnv('DATABASE_OWNER_URL'));
  } catch (err) {
    throw new Error(
      `Postgres not reachable or migrations failed: start it with pnpm dev:infra (${String(err)})`,
    );
  }
}
