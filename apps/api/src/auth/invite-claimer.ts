import { Inject, Injectable } from '@nestjs/common';
import { groupForRole, roleForGroupPath, type Role } from '@tenantry/auth';
import {
  findOpenInviteByEmail,
  hasRevokedInvite,
  insertAudit,
  markInviteAccepted,
  tenantTx,
  type Db,
  type TenantRecord,
} from '@tenantry/db';
import type { IdentityDirectory } from '@tenantry/keycloak-admin';
import { DB, IDENTITY_DIRECTORY } from '../infrastructure/tokens.js';

// A token whose organization block lists no group reaches here (ADR-0019). Three cases:
// - an invitee's first request: apply the role the inviter chose, once (the invite row is locked);
// - a role already applied, but the token predates it (tokens live five minutes): read the group;
// - someone who joined through a revoked invite: take them back out of the organization.
@Injectable()
export class InviteClaimer {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(IDENTITY_DIRECTORY) private readonly directory: IdentityDirectory,
  ) {}

  async claim(input: {
    tenant: TenantRecord;
    userId: string;
    kcUserId: string;
    email: string | null;
    emailVerified: boolean;
  }): Promise<Role | null> {
    const { tenant, userId, kcUserId, email, emailVerified } = input;
    if (!tenant.kcOrgId) return null;
    const orgId = tenant.kcOrgId;
    // Only a verified address may claim what was sent to that address. While the workspace moves to
    // Enterprise nobody joins: the move would leave them behind (ADR-0025).
    const claimable = emailVerified && tenant.status !== 'migrating' ? email : null;

    return tenantTx(this.db, tenant.id, async (tx) => {
      const invite = claimable ? await findOpenInviteByEmail(tx, claimable, { lock: true }) : null;
      if (invite) {
        await this.directory.setMemberGroup(orgId, kcUserId, groupForRole(invite.role));
        await markInviteAccepted(tx, invite.id);
        await insertAudit(tx, {
          actorUserId: userId,
          action: 'member.joined',
          target: userId,
          metadata: { role: invite.role, inviteId: invite.id },
        });
        return invite.role;
      }

      const member = (await this.directory.listMembers(orgId)).find((m) => m.kcUserId === kcUserId);
      if (member?.group) return roleForGroupPath(member.group);

      if (member && claimable && (await hasRevokedInvite(tx, claimable))) {
        await this.directory.removeMember(orgId, kcUserId);
        await insertAudit(tx, {
          actorUserId: null,
          action: 'member.removed',
          target: userId,
          metadata: { reason: 'joined through a revoked invite', email: claimable },
        });
      }
      return null;
    });
  }

  // Enterprise: the invite gave the role when it created the account, so the first sign-in only closes
  // the invite and records the join. Nothing happens for a person without an open invite.
  async acceptOnSignIn(input: {
    tenant: TenantRecord;
    userId: string;
    email: string | null;
    emailVerified: boolean;
  }): Promise<void> {
    const { tenant, userId, email, emailVerified } = input;
    if (!email || !emailVerified) return;
    await tenantTx(this.db, tenant.id, async (tx) => {
      const invite = await findOpenInviteByEmail(tx, email, { lock: true });
      if (!invite) return;
      await markInviteAccepted(tx, invite.id);
      await insertAudit(tx, {
        actorUserId: userId,
        action: 'member.joined',
        target: userId,
        metadata: { role: invite.role, inviteId: invite.id },
      });
    });
  }
}
