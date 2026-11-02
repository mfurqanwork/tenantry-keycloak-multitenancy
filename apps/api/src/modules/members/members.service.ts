import { Inject, Injectable } from '@nestjs/common';
import {
  canAssignRole,
  groupForRole,
  highestRole,
  roleForGroupPath,
  type Role,
  type TenantContext,
} from '@tenantry/auth';
import {
  createInvite,
  listOpenInvites,
  OpenInviteExistsError,
  platformRepository,
  revokeInvite,
  tenantTx,
  type Db,
  type InviteRecord,
  type TenantRecord,
} from '@tenantry/db';
import type { DirectoryMember, IdentityDirectory } from '@tenantry/keycloak-admin';
import { ConflictProblem, ForbiddenProblem, NotFoundProblem } from '../../common/http-errors.js';
import { DB, IDENTITY_DIRECTORY } from '../../infrastructure/tokens.js';
import { AuditService } from '../audit/audit.service.js';

export interface MemberView {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: Role | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roleOf = (m: DirectoryMember): Role | null => (m.group ? roleForGroupPath(m.group) : null);

// Keycloak holds membership and roles (organization groups); our database holds invites and the audit log.
@Injectable()
export class MembersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(IDENTITY_DIRECTORY) private readonly directory: IdentityDirectory,
    private readonly audit: AuditService,
  ) {}

  async list(
    ctx: TenantContext,
    tenant: TenantRecord,
  ): Promise<{ members: MemberView[]; invites: InviteRecord[] }> {
    const { orgId, issuer } = this.identity(tenant);
    const platform = platformRepository(this.db);
    const listed = await this.directory.listMembers(orgId);
    // Every member gets our own user id, even one who has never signed in yet.
    const members = await Promise.all(
      listed.map(async (m) => ({
        userId: (
          await platform.upsertIdentity({
            issuer,
            subject: m.kcUserId,
            email: m.email,
            displayName: m.displayName,
          })
        ).userId,
        email: m.email,
        displayName: m.displayName,
        role: roleOf(m),
      })),
    );
    const invites = await tenantTx(this.db, ctx.tenantId, (tx) => listOpenInvites(tx));
    return { members, invites };
  }

  async invite(
    ctx: TenantContext,
    tenant: TenantRecord,
    input: { email: string; role: Role },
  ): Promise<InviteRecord> {
    this.mayAssign(ctx, null, input.role);
    const { orgId } = this.identity(tenant);
    return tenantTx(this.db, ctx.tenantId, async (tx) => {
      let invite: InviteRecord;
      try {
        invite = await createInvite(tx, { email: input.email, role: input.role, invitedBy: ctx.userId });
      } catch (err) {
        if (err instanceof OpenInviteExistsError)
          throw new ConflictProblem('This person already has an open invite.');
        throw err;
      }
      // Inside the transaction: if Keycloak refuses, the invite row is rolled back too.
      await this.directory.inviteUser(orgId, input.email);
      await this.audit.record(tx, ctx, 'member.invited', invite.id, { email: input.email, role: input.role });
      return invite;
    });
  }

  async revokeInvite(ctx: TenantContext, id: string): Promise<void> {
    await tenantTx(this.db, ctx.tenantId, async (tx) => {
      if (!UUID.test(id) || !(await revokeInvite(tx, id)))
        throw new NotFoundProblem('No open invite with this id.');
      await this.audit.record(tx, ctx, 'invite.revoked', id);
    });
  }

  async changeRole(ctx: TenantContext, tenant: TenantRecord, userId: string, to: Role): Promise<void> {
    if (userId === ctx.userId) throw new ForbiddenProblem('You cannot change your own role.');
    const { orgId } = this.identity(tenant);
    const { target, members } = await this.findMember(tenant, userId);
    const from = roleOf(target);
    this.mayAssign(ctx, from, to);
    if (from === 'owner' && to !== 'owner') this.keepAnOwner(members);
    await this.directory.setMemberGroup(orgId, target.kcUserId, groupForRole(to));
    await tenantTx(this.db, ctx.tenantId, (tx) =>
      this.audit.record(tx, ctx, 'member.role_changed', userId, { from, to }),
    );
  }

  async remove(ctx: TenantContext, tenant: TenantRecord, userId: string): Promise<void> {
    const { orgId } = this.identity(tenant);
    const { target, members } = await this.findMember(tenant, userId);
    const role = roleOf(target);
    if (role === 'owner') {
      if (highestRole(ctx.roles) !== 'owner')
        throw new ForbiddenProblem('Only an owner can remove an owner.');
      this.keepAnOwner(members);
    }
    await this.directory.removeMember(orgId, target.kcUserId);
    await tenantTx(this.db, ctx.tenantId, (tx) =>
      this.audit.record(tx, ctx, 'member.removed', userId, { email: target.email, role }),
    );
  }

  private identity(tenant: TenantRecord): { orgId: string; issuer: string } {
    if (!tenant.kcOrgId || !tenant.issuer) throw new Error(`tenant ${tenant.slug} has no organization`);
    return { orgId: tenant.kcOrgId, issuer: tenant.issuer };
  }

  // Owner counts are read from Keycloak at the moment of the change.
  private async findMember(
    tenant: TenantRecord,
    userId: string,
  ): Promise<{ target: DirectoryMember; members: DirectoryMember[] }> {
    const { orgId, issuer } = this.identity(tenant);
    const subject = UUID.test(userId)
      ? await platformRepository(this.db).subjectForUser(userId, issuer)
      : null;
    const members = subject ? await this.directory.listMembers(orgId) : [];
    const target = members.find((m) => m.kcUserId === subject);
    if (!target) throw new NotFoundProblem('No such member in this workspace.');
    return { target, members };
  }

  private mayAssign(ctx: TenantContext, from: Role | null, to: Role): void {
    const actor = highestRole(ctx.roles);
    if (!actor || !canAssignRole(actor, from, to))
      throw new ForbiddenProblem('Only an owner can make or unmake an owner.');
  }

  private keepAnOwner(members: DirectoryMember[]): void {
    if (members.filter((m) => roleOf(m) === 'owner').length <= 1) {
      throw new ConflictProblem('A workspace needs at least one owner. Make someone else an owner first.');
    }
  }
}
