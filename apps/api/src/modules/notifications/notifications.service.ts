import { Inject, Injectable } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import {
  findActiveScimToken,
  getReadUntil,
  listAuditSince,
  markRead,
  openInvitesForEmail,
  platformRepository,
  tenantTx,
  type Db,
  type TenantRecord,
} from '@tenantry/db';
import type { SignedInUser } from '../../auth/request-context.js';
import { DB } from '../../infrastructure/tokens.js';
import { notificationFor, NOTIFIED_ACTIONS, type Notification } from './notification-rules.js';

const LIMIT = 30;
const DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const EXPIRY_WARNING_DAYS = 14;
const ROLE = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const;

// Notifications are read from the audit log, which every change already writes (ADR-0028); this module
// only keeps how far each person has read.
@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(
    ctx: TenantContext,
    tenant: TenantRecord,
    user: SignedInUser,
    now = new Date(),
  ): Promise<{ items: Notification[]; unread: number }> {
    const viewer = {
      userId: ctx.userId,
      team: ctx.permissions.has('members:invite'),
      security: ctx.permissions.has('tenant:settings'),
      workspaceName: tenant.name,
    };
    const since = new Date(now.getTime() - WINDOW_DAYS * DAY);
    const { entries, readUntil, token } = await tenantTx(this.db, tenant.id, async (tx) => ({
      entries: await listAuditSince(tx, { since, actions: [...NOTIFIED_ACTIONS], limit: LIMIT * 3 }),
      readUntil: await getReadUntil(tx, ctx.userId),
      token: viewer.security ? await findActiveScimToken(tx) : null,
    }));
    const people = await platformRepository(this.db).usersByIds([
      ...new Set(entries.flatMap((e) => [e.target, e.actorUserId ?? ''].filter(isUuid))),
    ]);
    const names = new Map([...people].map(([id, u]) => [id, u.displayName ?? u.email ?? 'Someone']));
    const unread = (createdAt: string) => !readUntil || new Date(createdAt) > readUntil;

    const items: Notification[] = [];
    for (const entry of entries) {
      const n = notificationFor(entry, viewer, names);
      if (n) items.push({ ...n, unread: unread(n.createdAt) });
      if (items.length === LIMIT) break;
    }

    // Worked out on reading: a directory sync token about to stop working.
    if (token && token.expiresAt.getTime() - now.getTime() <= EXPIRY_WARNING_DAYS * DAY) {
      const days = Math.max(0, Math.ceil((token.expiresAt.getTime() - now.getTime()) / DAY));
      const at = new Date(
        Math.max(token.expiresAt.getTime() - EXPIRY_WARNING_DAYS * DAY, token.createdAt.getTime()),
      );
      items.push({
        id: `scim-token-${token.id}`,
        kind: 'expiring',
        title:
          days === 0
            ? 'The directory sync token has expired'
            : `The directory sync token expires in ${String(days)} days`,
        body: 'Replace it so your directory keeps syncing.',
        link: { app: 'admin', path: '/advanced/scim' },
        createdAt: at.toISOString(),
        unread: unread(at.toISOString()),
      });
    }

    // Invites to other workspaces: only for a verified email (ADR-0028).
    if (user.email && user.emailVerified) {
      for (const invite of await openInvitesForEmail(this.db, user.email)) {
        if (invite.slug === tenant.slug) continue;
        items.push({
          id: `invite-${invite.slug}`,
          kind: 'invite',
          title: `You're invited to ${invite.name}`,
          body: `As ${ROLE[invite.role]}. Open it to join.`,
          link: { app: 'web', path: '/', workspace: invite.slug },
          createdAt: invite.invitedAt.toISOString(),
          unread: unread(invite.invitedAt.toISOString()),
        });
      }
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, unread: items.filter((i) => i.unread).length };
  }

  async markRead(ctx: TenantContext, tenant: TenantRecord, now = new Date()): Promise<void> {
    await tenantTx(this.db, tenant.id, (tx) => markRead(tx, ctx.userId, now));
  }
}

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
