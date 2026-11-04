import { sql } from 'drizzle-orm';
import { tenantMigrations } from '../schema/index.js';
import type { TenantTx } from '../tenant-tx.js';

export interface MigrationRecord {
  fromOrgId: string;
  realm: string;
  startedAt: Date;
  cutOverAt: Date | null;
  finishedAt: Date | null;
  abortedAt: Date | null;
}

const columns = {
  fromOrgId: tenantMigrations.fromOrgId,
  realm: tenantMigrations.realm,
  startedAt: tenantMigrations.startedAt,
  cutOverAt: tenantMigrations.cutOverAt,
  finishedAt: tenantMigrations.finishedAt,
  abortedAt: tenantMigrations.abortedAt,
};

export async function getMigration(tx: TenantTx): Promise<MigrationRecord | null> {
  const [row] = await tx.select(columns).from(tenantMigrations);
  return row ?? null;
}

// The move that is under way, or a new one; a rerun gets back the row it began with. An aborted move
// is started afresh.
export async function startMigration(
  tx: TenantTx,
  input: { fromOrgId: string; realm: string },
): Promise<MigrationRecord> {
  await tx
    .insert(tenantMigrations)
    .values(input)
    .onConflictDoUpdate({
      target: tenantMigrations.tenantId,
      set: {
        ...input,
        startedAt: sql`clock_timestamp()`,
        cutOverAt: null,
        finishedAt: null,
        abortedAt: null,
      },
      setWhere: sql`${tenantMigrations.abortedAt} is not null`,
    });
  const row = await getMigration(tx);
  if (!row) throw new Error('migration row missing after insert');
  return row;
}

// Each stamp is written once; a rerun keeps the first time.
export async function markCutOver(tx: TenantTx): Promise<void> {
  await tx
    .update(tenantMigrations)
    .set({ cutOverAt: sql`coalesce(${tenantMigrations.cutOverAt}, clock_timestamp())` });
}

export async function markFinished(tx: TenantTx): Promise<void> {
  await tx
    .update(tenantMigrations)
    .set({ finishedAt: sql`coalesce(${tenantMigrations.finishedAt}, clock_timestamp())` });
}

export async function markAborted(tx: TenantTx): Promise<void> {
  await tx
    .update(tenantMigrations)
    .set({ abortedAt: sql`coalesce(${tenantMigrations.abortedAt}, clock_timestamp())` });
}
