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
    if (!keeps && change.userId && (await revokeConsole(tx, change.userId))) {
      await this.consoles.forRealm(tenant.realm).revoke(change.kcUserId);
      await this.audit.record(tx, actor, 'console.revoked', change.userId, { reason: 'role' });
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

  // Our user ids that have console access in this tenant (enterprise only; empty otherwise).
  async holders(tenant: TenantRecord): Promise<Set<string>> {
    if (tenant.tier !== 'enterprise') return new Set();
    return new Set(await tenantTx(this.db, tenant.id, (tx) => listConsole(tx)));
  }

  async consoleUrlFor(tenant: TenantRecord, userId: string): Promise<string | undefined> {
    if (tenant.tier !== 'enterprise' || !tenant.realm) return undefined;
    if (!(await this.holders(tenant)).has(userId)) return undefined;
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
