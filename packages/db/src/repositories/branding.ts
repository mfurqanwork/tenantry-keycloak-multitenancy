import { sql } from 'drizzle-orm';
import { tenantLogos } from '../schema/index.js';
import type { TenantTx } from '../tenant-tx.js';

export interface LogoRecord {
  contentType: string;
  bytes: Buffer;
  updatedAt: Date;
}

// No tenant filter here on purpose: row-level security supplies it.
export async function getLogo(tx: TenantTx): Promise<LogoRecord | null> {
  const [row] = await tx
    .select({
      contentType: tenantLogos.contentType,
      bytes: tenantLogos.bytes,
      updatedAt: tenantLogos.updatedAt,
    })
    .from(tenantLogos);
  return row ?? null;
}

// One row per tenant: a new logo replaces the old one.
export async function putLogo(tx: TenantTx, input: { contentType: string; bytes: Buffer }): Promise<void> {
  await tx
    .insert(tenantLogos)
    .values(input)
    .onConflictDoUpdate({
      target: tenantLogos.tenantId,
      set: { ...input, updatedAt: sql`clock_timestamp()` },
    });
}

export async function deleteLogo(tx: TenantTx): Promise<boolean> {
  const removed = await tx.delete(tenantLogos).returning({ tenantId: tenantLogos.tenantId });
  return removed.length > 0;
}
