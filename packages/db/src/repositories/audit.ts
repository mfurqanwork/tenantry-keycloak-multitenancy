import { desc, sql } from 'drizzle-orm';
import { auditLog } from '../schema/index.js';
import type { TenantTx } from '../tenant-tx.js';

export interface AuditEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  target: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export async function insertAudit(
  tx: TenantTx,
  entry: { actorUserId: string | null; action: string; target: string; metadata?: Record<string, unknown> },
): Promise<void> {
  await tx.insert(auditLog).values({ ...entry, metadata: entry.metadata ?? {} });
}

// Newest first. `before` is the id of the last entry already shown.
export function listAudit(
  tx: TenantTx,
  options: { before?: string | undefined; limit: number },
): Promise<AuditEntry[]> {
  const after = options.before
    ? sql`(${auditLog.createdAt}, ${auditLog.id}) < (select created_at, id from audit_log where id = ${options.before})`
    : undefined;
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
    .where(after)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(options.limit);
}
