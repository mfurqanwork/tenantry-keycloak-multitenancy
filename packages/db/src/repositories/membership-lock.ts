import { sql } from 'drizzle-orm';
import type { TenantTx } from '../tenant-tx.js';

// Holds a per-tenant lock until the transaction ends, so membership changes in one tenant run one at
// a time (two owners demoting each other at once must not both succeed).
export async function lockTenantMembership(tx: TenantTx): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('membership:' || current_setting('app.tenant_id')))`,
  );
}
