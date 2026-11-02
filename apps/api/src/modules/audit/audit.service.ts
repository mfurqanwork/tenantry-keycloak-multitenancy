import { Inject, Injectable } from '@nestjs/common';
import { insertAudit, listAudit, platformRepository, tenantTx, type Db, type TenantTx } from '@tenantry/db';
import { DB } from '../../infrastructure/tokens.js';

export type AuditAction =
  | 'tenant.created'
  | 'member.invited'
  | 'invite.revoked'
  | 'member.joined'
  | 'member.role_changed'
  | 'member.removed'
  | 'project.created';

export interface AuditView {
  id: string;
  action: string;
  target: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: { id: string | null; email: string | null };
}

const PAGE = 50;

// AGENTS.md rule 5: every identity change calls record(), inside the transaction that made it.
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  record(
    tx: TenantTx,
    actor: { userId: string },
    action: AuditAction,
    target: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    return insertAudit(tx, { actorUserId: actor.userId, action, target, ...(metadata ? { metadata } : {}) });
  }

  async list(
    tenantId: string,
    before?: string,
  ): Promise<{ entries: AuditView[]; nextBefore: string | null }> {
    const entries = await tenantTx(this.db, tenantId, (tx) => listAudit(tx, { before, limit: PAGE }));
    const actorIds = [
      ...new Set(entries.map((e) => e.actorUserId).filter((id): id is string => id !== null)),
    ];
    const actors = await platformRepository(this.db).usersByIds(actorIds);
    return {
      entries: entries.map((e) => ({
        id: e.id,
        action: e.action,
        target: e.target,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
        actor: {
          id: e.actorUserId,
          email: e.actorUserId ? (actors.get(e.actorUserId)?.email ?? null) : null,
        },
      })),
      nextBefore: entries.length === PAGE ? (entries.at(-1)?.id ?? null) : null,
    };
  }
}
