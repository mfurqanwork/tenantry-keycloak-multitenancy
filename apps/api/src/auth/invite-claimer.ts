import { Inject, Injectable } from '@nestjs/common';
import { groupForRole, type Role } from '@tenantry/auth';
import {
  findOpenInviteByEmail,
  insertAudit,
  markInviteAccepted,
  tenantTx,
  type Db,
  type TenantRecord,
} from '@tenantry/db';
import type { IdentityDirectory } from '@tenantry/keycloak-admin';
import { DB, IDENTITY_DIRECTORY } from '../infrastructure/tokens.js';

// An invitee who accepted Keycloak's invite is in the organization but in no group yet.
// Their first request applies the role the inviter chose (ADR-0019).
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
  }): Promise<Role | null> {
    const { tenant, userId, kcUserId, email } = input;
    if (!email || !tenant.kcOrgId) return null;
    const orgId = tenant.kcOrgId;
    return tenantTx(this.db, tenant.id, async (tx) => {
      const invite = await findOpenInviteByEmail(tx, email);
      if (!invite) return null;
      await this.directory.setMemberGroup(orgId, kcUserId, groupForRole(invite.role));
      await markInviteAccepted(tx, invite.id);
      await insertAudit(tx, {
        actorUserId: userId,
        action: 'member.joined',
        target: userId,
        metadata: { role: invite.role, inviteId: invite.id },
      });
      return invite.role;
    });
  }
}
