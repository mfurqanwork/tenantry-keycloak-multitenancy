import type { Role } from '@tenantry/auth';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Executor } from './executor.js';
import { auditLog, notificationReads } from '../schema/index.js';
import type { TenantTx } from '../tenant-tx.js';
import type { AuditEntry } from './audit.js';

// When this person last read their notifications in this workspace; null if never.
export async function getReadUntil(tx: TenantTx, userId: string): Promise<Date | null> {
  const [row] = await tx
    .select({ readUntil: notificationReads.readUntil })
    .from(notificationReads)
    .where(eq(notificationReads.userId, userId));
  return row?.readUntil ?? null;
}

// Moves "read up to" forward, never back.
export async function markRead(tx: TenantTx, userId: string, at: Date): Promise<void> {
  await tx
    .insert(notificationReads)
    .values({ userId, readUntil: at })
    .onConflictDoUpdate({
      target: [notificationReads.tenantId, notificationReads.userId],
      set: { readUntil: sql`greatest(${notificationReads.readUntil}, excluded.read_until)` },
    });
}

// The workspace's audit entries of these kinds since a time, newest first.
export function listAuditSince(
  tx: TenantTx,
  input: { since: Date; actions: string[]; limit: number },
): Promise<AuditEntry[]> {
  return tx
    .select({
      id: auditLog.id,
      actorUserId: auditLog.actorUserId,
      action: auditLog.action,
      target: auditLog.target,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(and(gte(auditLog.createdAt, input.since), inArray(auditLog.action, input.actions)))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(input.limit);
}

// Active workspaces with an open invite to exactly this email (ADR-0028). Call it only with a verified email.
export async function openInvitesForEmail(
  db: Executor,
  email: string,
): Promise<{ slug: string; name: string; role: Role; invitedAt: Date }[]> {
  const result = await db.execute<{ slug: string; name: string; role: Role; invited_at: string | Date }>(
    sql`select slug, name, role, invited_at from open_invites_for_email(${email})`,
  );
  return result.rows.map(({ slug, name, role, invited_at }) => ({
    slug,
    name,
    role,
    invitedAt: new Date(invited_at),
  }));
}
