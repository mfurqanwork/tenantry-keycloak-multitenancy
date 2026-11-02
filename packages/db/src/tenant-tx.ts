import { sql } from 'drizzle-orm';
import type { Db } from './db.js';

type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

// A transaction whose app.tenant_id is set. Tenant repositories accept nothing else.
export type TenantTx = Transaction & { readonly __tenant: string };

// The only way to reach tenant tables (AGENTS.md rule 1). set_config(..., true) is SET LOCAL:
// the value ends with the transaction, so a pooled connection never carries it to the next request.
export async function tenantTx<T>(db: Db, tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(Object.assign(tx, { __tenant: tenantId }));
  });
}
