import type { Db } from '../db.js';
import type { TenantTx } from '../tenant-tx.js';

// Platform tables can be reached from a plain connection or from inside a tenant transaction.
export type Executor = Db | TenantTx;
