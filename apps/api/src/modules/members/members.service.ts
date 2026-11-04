import { Inject, Injectable } from '@nestjs/common';
import {
  canAssignRole,
  permissionsFor,
  type Permission,
  type Role,
  type TenantContext,
} from '@tenantry/auth';
import {
  createInvite,
  listOpenInvites,
  lockTenantMembership,
  OpenInviteExistsError,
  platformRepository,
  revokeInvite,
  tenantTx,
  type Db,
  type InviteRecord,
  type TenantRecord,
  type TenantTx,
} from '@tenantry/db';
import type { Member, MemberDirectory } from '@tenantry/keycloak-admin';
import type { SignedInUser } from '../../auth/request-context.js';
import { ConflictProblem, ForbiddenProblem, NotFoundProblem } from '../../common/http-errors.js';
import type { MemberDirectories } from '../../infrastructure/member-directories.js';
import { DB, MEMBER_DIRECTORIES } from '../../infrastructure/tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { ConsoleAccessService } from '../console/console.service.js';

export interface MemberView {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: Role | null;
  // Enterprise workspaces: whether they may open the realm's Keycloak console (ADR-0026).
  console?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Keycloak holds membership and roles (Standard: organization groups; Enterprise: tenantry-api client
// roles in the tenant's realm); our database holds invites and the audit log.
@Injectable()
export class MembersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MEMBER_DIRECTORIES) private readonly directories: MemberDirectories,
    private readonly audit: AuditService,
    private readonly console: ConsoleAccessService,
  ) {}

  async list(
    ctx: TenantContext,
    tenant: TenantRecord,
  ): Promise<{ members: MemberView[]; invites: InviteRecord[] }> {
    const issuer = this.issuer(tenant);
    const platform = platformRepository(this.db);
    const listed = await (await this.directories.forTenant(tenant)).listMembers();
    const holders = await this.console.holders(tenant);
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
        role: m.role,
      })),
    );
    const withConsole =
      tenant.tier === 'enterprise' ? members.map((m) => ({ ...m, console: holders.has(m.userId) })) : members;
    const invites = await tenantTx(this.db, ctx.tenantId, (tx) => listOpenInvites(tx));
    return { members: withConsole, invites };
  }

  async invite(
    ctx: TenantContext,
    tenant: TenantRecord,
    actor: SignedInUser,
    input: { email: string; role: Role },
  ): Promise<InviteRecord> {
    const members = await this.directories.forTenant(tenant);
    return this.underLock(ctx, async (tx) => {
      const listed = await members.listMembers();
      const actorRole = this.liveRole(listed, actor, 'members:invite');
      this.mayAssign(actorRole, null, input.role);
      // An invite only brings someone in; a member's role changes through the role rules, never here.
      const address = input.email.toLowerCase();
      if (listed.some((m) => m.role !== null && m.email?.toLowerCase() === address)) {
        throw new ConflictProblem('This person is already a member.');
      }
      let invite: InviteRecord;
      try {
        invite = await createInvite(tx, { email: input.email, role: input.role, invitedBy: ctx.userId });
      } catch (err) {
        if (err instanceof OpenInviteExistsError) {
          throw new ConflictProblem('This person already has an open invite.');
        }
        throw err;
      }
      // Inside the transaction: if Keycloak refuses, the invite row is rolled back too. Enterprise: the
      // account exists at once with the role; the invite is accepted when the person first signs in.
      const { kcUserId } = await members.invite(input.email, input.role);
      await this.audit.record(tx, ctx, 'member.invited', invite.id, { email: input.email, role: input.role });
      // An enterprise invite as owner makes an owner at once: console users must not change them.
      if (kcUserId && input.role === 'owner') await this.console.syncOwners(tenant);
      return invite;
    });
  }

  async revokeInvite(
    ctx: TenantContext,
    tenant: TenantRecord,
    actor: SignedInUser,
    id: string,
  ): Promise<void> {
    const members = await this.directories.forTenant(tenant);
    await this.underLock(ctx, async (tx) => {
      const listed = await members.listMembers();
      this.liveRole(listed, actor, 'members:invite');
      const open = UUID.test(id) ? (await listOpenInvites(tx)).find((i) => i.id === id) : undefined;
      if (!open || !(await revokeInvite(tx, id))) {
        throw new NotFoundProblem('No open invite with this id.');
      }
      // Enterprise: the account the invite created goes too, unless the person has already used it;
      // then the account stays and the role the invite gave is taken back. (An invite never reaches an
      // existing member, so that role came from this invite.)
      const invitee = listed.find((m) => m.email?.toLowerCase() === open.email.toLowerCase());
      const deleted = invitee ? await members.deleteUnusedUser(invitee.kcUserId) : false;
      if (invitee && !deleted) await members.remove(invitee.kcUserId);
      const outcome = deleted ? { accountDeleted: true } : invitee ? { accessRemoved: true } : undefined;
      await this.audit.record(tx, ctx, 'invite.revoked', id, outcome);
    });
  }

  async changeRole(
    ctx: TenantContext,
    tenant: TenantRecord,
    actor: SignedInUser,
    userId: string,
    to: Role,
  ): Promise<void> {
    if (userId === ctx.userId) throw new ForbiddenProblem('You cannot change your own role.');
    const directory = await this.directories.forTenant(tenant);
    await this.underLock(ctx, async (tx) => {
      const { target, members } = await this.findMember(tenant, directory, userId);
      const actorRole = this.liveRole(members, actor, 'members:change-role');
      const from = target.role;
      this.mayAssign(actorRole, from, to);
      if (from === 'owner' && to !== 'owner') this.keepAnOwner(members);
      await directory.setRole(target.kcUserId, to);
      await this.audit.record(tx, ctx, 'member.role_changed', userId, { from, to });
      await this.console.afterRoleChange(tx, ctx, tenant, { kcUserId: target.kcUserId, userId, to });
    });
  }

  async remove(ctx: TenantContext, tenant: TenantRecord, actor: SignedInUser, userId: string): Promise<void> {
    const directory = await this.directories.forTenant(tenant);
    await this.underLock(ctx, async (tx) => {
      const { target, members } = await this.findMember(tenant, directory, userId);
      const actorRole = this.liveRole(members, actor, 'members:remove');
      const role = target.role;
      if (role === 'owner') {
        if (actorRole !== 'owner') throw new ForbiddenProblem('Only an owner can remove an owner.');
        this.keepAnOwner(members);
      }
      await directory.remove(target.kcUserId);
      await this.audit.record(tx, ctx, 'member.removed', userId, { email: target.email, role });
      await this.console.afterRoleChange(tx, ctx, tenant, { kcUserId: target.kcUserId, userId, to: null });
    });
  }

  // Anyone may leave a workspace they belong to, except its last owner.
  async leave(ctx: TenantContext, tenant: TenantRecord, actor: SignedInUser): Promise<void> {
    const directory = await this.directories.forTenant(tenant);
    await this.underLock(ctx, async (tx) => {
      const members = await directory.listMembers();
      const me = members.find((m) => m.kcUserId === actor.kcUserId);
      if (!me) throw new ForbiddenProblem();
      const role = me.role;
      if (role === 'owner' && members.filter((m) => m.role === 'owner').length <= 1) {
        throw new ConflictProblem('You are the last owner. Make someone else an owner first.');
      }
      await directory.remove(actor.kcUserId);
      await this.audit.record(tx, ctx, 'member.left', ctx.userId, { email: me.email, role });
      await this.console.afterRoleChange(tx, ctx, tenant, {
        kcUserId: actor.kcUserId,
        userId: ctx.userId,
        to: null,
      });
    });
  }

  private issuer(tenant: TenantRecord): string {
    if (!tenant.issuer) throw new Error(`tenant ${tenant.slug} has no issuer`);
    return tenant.issuer;
  }

  // Membership changes in one tenant run one at a time: owner counts read inside stay true until
  // the change is written (two owners demoting each other at once cannot both succeed).
  private underLock<T>(ctx: TenantContext, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    return tenantTx(this.db, ctx.tenantId, async (tx) => {
      await lockTenantMembership(tx);
      return fn(tx);
    });
  }

  // The token's role can be up to five minutes old. Identity changes use the role Keycloak holds now,
  // so someone removed or demoted cannot keep acting (or invite themselves back) in that window.
  private liveRole(members: Member[], actor: SignedInUser, permission: Permission): Role {
    const role = members.find((m) => m.kcUserId === actor.kcUserId)?.role ?? null;
    if (!role || !permissionsFor([role]).has(permission)) throw new ForbiddenProblem();
    return role;
  }

  private async findMember(
    tenant: TenantRecord,
    directory: MemberDirectory,
    userId: string,
  ): Promise<{ target: Member; members: Member[] }> {
    const issuer = this.issuer(tenant);
    const subject = UUID.test(userId)
      ? await platformRepository(this.db).subjectForUser(userId, issuer)
      : null;
    const members = await directory.listMembers();
    const target = members.find((m) => m.kcUserId === subject);
    if (!target) throw new NotFoundProblem('No such member in this workspace.');
    return { target, members };
  }

  private mayAssign(actor: Role, from: Role | null, to: Role): void {
    if (!canAssignRole(actor, from, to)) {
      throw new ForbiddenProblem('Only an owner can make or unmake an owner.');
    }
  }

  private keepAnOwner(members: Member[]): void {
    if (members.filter((m) => m.role === 'owner').length <= 1) {
      throw new ConflictProblem('A workspace needs at least one owner. Make someone else an owner first.');
    }
  }
}
