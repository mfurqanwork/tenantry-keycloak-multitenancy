import { Inject, Injectable } from '@nestjs/common';
import type { Role, TenantContext } from '@tenantry/auth';
import {
  grantConsole,
  listConsole,
  lockTenantMembership,
  platformRepository,
  revokeConsole,
  tenantTx,
  type Db,
  type TenantRecord,
  type TenantTx,
} from '@tenantry/db';
import { NotFoundProblem, ValidationProblem } from '../../common/http-errors.js';
import type { MemberDirectories } from '../../infrastructure/member-directories.js';
import type { RealmConsoleFactory } from '../../infrastructure/realm-console.js';
import { DB, MEMBER_DIRECTORIES, REALM_CONSOLE } from '../../infrastructure/tokens.js';
import { AuditService } from '../audit/audit.service.js';

const ENTERPRISE_ONLY = 'Console access is available on Enterprise workspaces.';
const MAY_HAVE: Role[] = ['owner', 'admin'];

// Who may open an enterprise realm's Keycloak console, for people and groups only (ADR-0026). Our row,
// the realm's console group and role, and the owners console users may not change, kept in step.
@Injectable()
export class ConsoleAccessService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MEMBER_DIRECTORIES) private readonly directories: MemberDirectories,
    @Inject(REALM_CONSOLE) private readonly consoles: RealmConsoleFactory,
    private readonly audit: AuditService,
  ) {}

  async grant(ctx: TenantContext, tenant: TenantRecord, userId: string): Promise<void> {
    const realm = this.realmOf(tenant);
    await this.underLock(ctx, async (tx) => {
      const target = await this.member(tenant, userId);
      if (!target.role || !MAY_HAVE.includes(target.role)) {
        throw new ValidationProblem('Console access is for owners and admins.');
      }
      if (!(await grantConsole(tx, { userId, grantedBy: ctx.userId }))) return;
      // Last before the audit: a refusal rolls the row back.
      await this.consoles.forRealm(realm).grant(target.kcUserId);
      await this.audit.record(tx, ctx, 'console.granted', userId);
    });
  }

  async revoke(ctx: TenantContext, tenant: TenantRecord, userId: string): Promise<void> {
    const realm = this.realmOf(tenant);
    await this.underLock(ctx, async (tx) => {
      const target = await this.member(tenant, userId);
      if (!(await revokeConsole(tx, userId))) return;
      await this.consoles.forRealm(realm).revoke(target.kcUserId);
      await this.audit.record(tx, ctx, 'console.revoked', userId);
    });
  }

  // After someone's role changed, inside the transaction that changed it: a person who is no longer an
  // owner or admin loses console access, and the owners console users may not change are rewritten.
  async afterRoleChange(
    tx: TenantTx,
    actor: { userId: string | null },
    tenant: TenantRecord,
    change: { kcUserId: string; userId: string | null; to: Role | null },
  ): Promise<void> {
    if (tenant.tier !== 'enterprise' || !tenant.realm) return;
    const keeps = change.to !== null && MAY_HAVE.includes(change.to);
    if (!keeps) {
      // Keycloak too, row or not: a grant that failed half-way may have left them in the group.
      const had = change.userId ? await revokeConsole(tx, change.userId) : false;
      await this.consoles.forRealm(tenant.realm).revoke(change.kcUserId);
      if (had && change.userId) {
        await this.audit.record(tx, actor, 'console.revoked', change.userId, { reason: 'role' });
      }
    }
    await this.syncOwners(tenant);
  }

  // The realm's current owners, as console users may see but not change them.
  async syncOwners(tenant: TenantRecord): Promise<void> {
    if (tenant.tier !== 'enterprise' || !tenant.realm) return;
    const members = await (await this.directories.forTenant(tenant)).listMembers();
    const owners = members.filter((m) => m.role === 'owner').map((m) => m.kcUserId);
    await this.consoles.forRealm(tenant.realm).protectOwners(owners);
  }

  // After a change Tenantry did not make (the directory over SCIM): whoever has console access but is no
  // longer an owner or admin loses it, and the owners are rewritten.
  async reconcile(tenant: TenantRecord): Promise<void> {
    if (tenant.tier !== 'enterprise' || !tenant.realm || !tenant.issuer) return;
    const realm = tenant.realm;
    const issuer = tenant.issuer;
    const members = await (await this.directories.forTenant(tenant)).listMembers();
    const roleOf = new Map(members.map((m) => [m.kcUserId, m.role]));
    await tenantTx(this.db, tenant.id, async (tx) => {
      await lockTenantMembership(tx);
      for (const userId of await listConsole(tx)) {
        const subject = await platformRepository(this.db).subjectForUser(userId, issuer);
        const role = subject ? roleOf.get(subject) : null;
        if (role && MAY_HAVE.includes(role)) continue;
        await revokeConsole(tx, userId);
        if (subject) await this.consoles.forRealm(realm).revoke(subject);
        await this.audit.record(tx, { userId: null }, 'console.revoked', userId, {
          reason: 'role',
          via: 'directory',
        });
      }
    });
    await this.syncOwners(tenant);
  }

  // Our user ids that have console access in this tenant (enterprise only; empty otherwise).
  async holders(tenant: TenantRecord): Promise<Set<string>> {
    if (tenant.tier !== 'enterprise') return new Set();
    return new Set(await tenantTx(this.db, tenant.id, (tx) => listConsole(tx)));
  }

  async consoleUrlFor(tenant: TenantRecord, userId: string): Promise<string | undefined> {
    if (tenant.tier !== 'enterprise' || !tenant.realm) return undefined;
    if (!(await this.holders(tenant)).has(userId)) return undefined;
    // The live role, not the row alone: a change outside Tenantry may have made them a member.
    const target = await this.member(tenant, userId).catch(() => null);
    if (!target?.role || !MAY_HAVE.includes(target.role)) return undefined;
    return this.consoles.forRealm(tenant.realm).consoleUrl();
  }

  private realmOf(tenant: TenantRecord): string {
    if (tenant.tier !== 'enterprise' || !tenant.realm) throw new NotFoundProblem(ENTERPRISE_ONLY);
    return tenant.realm;
  }

  private async member(tenant: TenantRecord, userId: string) {
    const subject = tenant.issuer
      ? await platformRepository(this.db).subjectForUser(userId, tenant.issuer)
      : null;
    const members = await (await this.directories.forTenant(tenant)).listMembers();
    const target = members.find((m) => m.kcUserId === subject);
    if (!target) throw new NotFoundProblem('No such member in this workspace.');
    return target;
  }

  // One membership change at a time per tenant, as the members service does.
  private underLock<T>(ctx: TenantContext, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    return tenantTx(this.db, ctx.tenantId, async (tx) => {
      await lockTenantMembership(tx);
      return fn(tx);
    });
  }
}
