import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Role } from '@tenantry/auth';
import { isUniqueViolation, OpenInviteExistsError } from '../errors.js';
import { tenantInvites } from '../schema/index.js';
import type { TenantTx } from '../tenant-tx.js';

export interface InviteRecord {
  id: string;
  email: string;
  role: Role;
  invitedBy: string;
  createdAt: Date;
}

const columns = {
  id: tenantInvites.id,
  email: tenantInvites.email,
  role: tenantInvites.role,
  invitedBy: tenantInvites.invitedBy,
  createdAt: tenantInvites.createdAt,
};
const open = and(isNull(tenantInvites.acceptedAt), isNull(tenantInvites.revokedAt));

export async function createInvite(
  tx: TenantTx,
  input: { email: string; role: Role; invitedBy: string },
): Promise<InviteRecord> {
  try {
    // A savepoint, so a duplicate does not poison the caller's transaction.
    return await tx.transaction(async (sp) => {
      const [row] = await sp.insert(tenantInvites).values(input).returning(columns);
      if (!row) throw new Error('insert returned no row');
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new OpenInviteExistsError(input.email);
    throw err;
  }
}

export function listOpenInvites(tx: TenantTx): Promise<InviteRecord[]> {
  return tx.select(columns).from(tenantInvites).where(open).orderBy(desc(tenantInvites.createdAt));
}

const sameEmail = (email: string) => sql`lower(${tenantInvites.email}) = lower(${email})`;

// lock: hold the row until the transaction ends, so two first requests cannot both claim it.
export async function findOpenInviteByEmail(
  tx: TenantTx,
  email: string,
  options: { lock?: boolean } = {},
): Promise<InviteRecord | null> {
  const query = tx
    .select(columns)
    .from(tenantInvites)
    .where(and(open, sameEmail(email)));
  const [row] = options.lock ? await query.for('update') : await query;
  return row ?? null;
}

export async function hasRevokedInvite(tx: TenantTx, email: string): Promise<boolean> {
  const rows = await tx
    .select({ id: tenantInvites.id })
    .from(tenantInvites)
    .where(and(isNotNull(tenantInvites.revokedAt), sameEmail(email)))
    .limit(1);
  return rows.length > 0;
}

export async function markInviteAccepted(tx: TenantTx, id: string): Promise<void> {
  await tx.update(tenantInvites).set({ acceptedAt: new Date() }).where(eq(tenantInvites.id, id));
}

export async function revokeInvite(tx: TenantTx, id: string): Promise<boolean> {
  const rows = await tx
    .update(tenantInvites)
    .set({ revokedAt: new Date() })
    .where(and(eq(tenantInvites.id, id), open))
    .returning({ id: tenantInvites.id });
  return rows.length > 0;
}
