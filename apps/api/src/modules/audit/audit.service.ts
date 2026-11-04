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
  | 'member.left'
  | 'project.created'
  | 'branding.updated'
  | 'branding.logo_updated'
  | 'branding.logo_removed'
  | 'domain.claimed'
  | 'domain.verified'
  | 'idp.linked'
  | 'tenant.provisioning'
  | 'tenant.upgraded'
  | 'app.registered'
  | 'app.updated'
  | 'app.secret_rotated'
  | 'app.deleted'
  | 'app.token_checked';

export interface AuditView {
  id: string;
  action: string;
  target: string;
  // What a person reads for the target: an email or a name; null when there is nothing better than the id.
  targetLabel: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: { id: string | null; email: string | null };
}

const PAGE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const labelFor = (metadata: Record<string, unknown>): string | null => {
  const { email, name } = metadata;
  if (typeof email === 'string') return email;
  return typeof name === 'string' ? name : null;
};

// AGENTS.md rule 5: every identity change calls record(), inside the transaction that made it.
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  record(
    tx: TenantTx,
    // No user for operator changes (pnpm ops): the metadata then says via: 'ops'.
    actor: { userId: string | null },
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
    // Targets that are users (role changes) are named by email; the rest carry a name in metadata.
    const targetIds = [...new Set(entries.map((e) => e.target).filter((id) => UUID.test(id)))];
    const people = await platformRepository(this.db).usersByIds([...new Set([...actorIds, ...targetIds])]);
    return {
      entries: entries.map((e) => ({
        id: e.id,
        action: e.action,
        target: e.target,
        targetLabel: labelFor(e.metadata) ?? people.get(e.target)?.email ?? null,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
        actor: {
          id: e.actorUserId,
          email: e.actorUserId ? (people.get(e.actorUserId)?.email ?? null) : null,
        },
      })),
      nextBefore: entries.length === PAGE ? (entries.at(-1)?.id ?? null) : null,
    };
  }
}
