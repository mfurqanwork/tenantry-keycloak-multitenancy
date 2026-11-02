import { runMigrations } from '@tenantry/db';
import { stackEnv } from './env.js';

export default async function setup(): Promise<void> {
  const ownerUrl = stackEnv('DATABASE_OWNER_URL');
  try {
    await runMigrations(ownerUrl);
  } catch (err) {
    throw new Error(
      `Postgres not reachable or migrations failed: start it with pnpm dev:infra (${String(err)})`,
    );
  }
}
