import { sql } from 'drizzle-orm';
import type { Db } from './db.js';

type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

// A transaction whose app.tenant_id is set. Tenant repositories accept nothing else.
export type TenantTx = Transaction & {
  readonly __tenant: string;
  // Work to do once the transaction has committed (afterCommit below).
  readonly __afterCommit?: (() => void)[];
};

// The only way to reach tenant tables (AGENTS.md rule 1). set_config(..., true) is SET LOCAL:
// the value ends with the transaction, so a pooled connection never carries it to the next request.
export async function tenantTx<T>(db: Db, tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  const committed: (() => void)[] = [];
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(Object.assign(tx, { __tenant: tenantId, __afterCommit: committed }));
  });
  for (const run of committed) {
    try {
      run();
    } catch {
      // Side work (analytics) never fails a change that has already committed.
    }
  }
  return result;
}

// Runs `run` only if the transaction commits; a rollback drops it. For side effects such as analytics.
export function afterCommit(tx: TenantTx, run: () => void): void {
  if (tx.__afterCommit) tx.__afterCommit.push(run);
  else run();
}
