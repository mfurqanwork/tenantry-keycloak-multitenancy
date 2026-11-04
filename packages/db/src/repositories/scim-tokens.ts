import { and, eq, isNull, sql } from 'drizzle-orm';
import { tenantScimTokens } from '../schema/index.js';
import type { TenantTx } from '../tenant-tx.js';

// Never carries the hash: callers look a hash up, they never read one back.
export interface ScimTokenRecord {
  id: string;
  expiresAt: Date;
  createdBy: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

const columns = {
  id: tenantScimTokens.id,
  expiresAt: tenantScimTokens.expiresAt,
  createdBy: tenantScimTokens.createdBy,
  createdAt: tenantScimTokens.createdAt,
  lastUsedAt: tenantScimTokens.lastUsedAt,
  revokedAt: tenantScimTokens.revokedAt,
};

export async function revokeScimTokens(tx: TenantTx): Promise<number> {
  const rows = await tx
    .update(tenantScimTokens)
    .set({ revokedAt: sql`clock_timestamp()` })
    .where(isNull(tenantScimTokens.revokedAt))
    .returning({ id: tenantScimTokens.id });
  return rows.length;
}

// A new token replaces the active one, in the same transaction.
export async function insertScimToken(
  tx: TenantTx,
  input: { tokenHash: Buffer; expiresAt: Date; createdBy: string | null },
): Promise<ScimTokenRecord> {
  await revokeScimTokens(tx);
  const [row] = await tx.insert(tenantScimTokens).values(input).returning(columns);
  if (!row) throw new Error('insert returned no row');
  return row;
}

export async function findActiveScimToken(tx: TenantTx): Promise<ScimTokenRecord | null> {
  const [row] = await tx.select(columns).from(tenantScimTokens).where(isNull(tenantScimTokens.revokedAt));
  return row ?? null;
}

// Revoked and expired tokens are found too: the caller decides they do not count.
export async function findScimTokenByHash(tx: TenantTx, hash: Buffer): Promise<ScimTokenRecord | null> {
  const [row] = await tx.select(columns).from(tenantScimTokens).where(eq(tenantScimTokens.tokenHash, hash));
  return row ?? null;
}

// The last use, at most once a minute (a directory sync makes many calls).
export async function touchScimToken(tx: TenantTx, id: string): Promise<void> {
  await tx
    .update(tenantScimTokens)
    .set({ lastUsedAt: sql`clock_timestamp()` })
    .where(
      and(
        eq(tenantScimTokens.id, id),
        sql`(${tenantScimTokens.lastUsedAt} is null or ${tenantScimTokens.lastUsedAt} < clock_timestamp() - interval '60 seconds')`,
      ),
    );
}

// Token changes in one tenant run one at a time, so exactly one stays active.
export async function lockTenantScim(tx: TenantTx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('scim:' || current_setting('app.tenant_id')))`);
}
