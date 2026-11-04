import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { roleForGroupPath, type Role } from '@tenantry/auth';
import {
  cutOver,
  getMigration,
  insertAudit,
  listIdps,
  listOpenInvites,
  markAborted,
  markFinished,
  platformRepository,
  startMigration,
  tenantTx,
  type Db,
  type TenantRecord,
} from '@tenantry/db';
import {
  BRIDGE_ALIAS,
  bridgeSecretKey,
  idpSecretKey,
  TEMPLATE_VERSION,
  type IdentityDirectory,
  type RealmBridge,
  type RealmIdps,
  type RealmMembers,
} from '@tenantry/keycloak-admin';
import type { SecretStore } from '@tenantry/keycloak-admin/secrets';
import { tenantOrigin } from '@tenantry/auth';
import { ConflictProblem, NotFoundProblem } from '../../common/http-errors.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import type { ByRealm } from '../../infrastructure/by-realm.js';
import type { RealmConsoleFactory } from '../../infrastructure/realm-console.js';
import {
  DB,
  IDENTITY_DIRECTORY,
  REALM_BRIDGE,
  REALM_CONSOLE,
  REALM_IDPS,
  REALM_MEMBERS,
  REALM_PROVISIONER,
  SECRET_STORE,
} from '../../infrastructure/tokens.js';
import type { RealmProvisioner } from '@tenantry/keycloak-admin';
import { EnterpriseService } from './enterprise.service.js';

export interface MigrationPlan {
  slug: string;
  realm: string;
  members: { email: string | null; role: Role | null }[];
  invites: number;
  companyLogins: { alias: string; secretKept: boolean }[];
}

export interface MigrationResult extends MigrationPlan {
  cutOver: boolean;
  // Company logins copied switched off: their secret was never kept (linked before 5b).
  waitingForSecret: string[];
}

const OPS = { actorUserId: null, metadata: { via: 'ops' } } as const;

// Moving a Standard workspace into a realm of its own (ADR-0025). Every step checks Keycloak and the
// migration row before acting, so a failed run is finished by running it again. Nothing in Postgres
// moves: the tenant id stays, and people keep their user ids through a second identity (ADR-0007).
@Injectable()
export class MigrationService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(IDENTITY_DIRECTORY) private readonly directory: IdentityDirectory,
    @Inject(REALM_PROVISIONER) private readonly provisioner: RealmProvisioner,
    @Inject(SECRET_STORE) private readonly secrets: SecretStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(REALM_MEMBERS) private readonly realmMembers: ByRealm<Promise<RealmMembers>>,
    @Inject(REALM_BRIDGE) private readonly bridges: ByRealm<RealmBridge>,
    @Inject(REALM_IDPS) private readonly idps: ByRealm<RealmIdps>,
    @Inject(REALM_CONSOLE) private readonly consoles: RealmConsoleFactory,
    private readonly enterprise: EnterpriseService,
  ) {}

  async migrate(slug: string, dryRun: boolean): Promise<MigrationPlan | MigrationResult> {
    const tenant = await this.find(slug);
    if (tenant.tier === 'enterprise') {
      const done = await tenantTx(this.db, tenant.id, (tx) => getMigration(tx));
      if (!done?.cutOverAt || done.abortedAt) throw new ConflictProblem('Already an enterprise workspace.');
      return {
        slug,
        realm: done.realm,
        members: [],
        invites: 0,
        companyLogins: [],
        cutOver: true,
        waitingForSecret: [],
      };
    }
    const orgId = tenant.kcOrgId;
    if (!orgId) throw new ConflictProblem('This workspace has no organization to move.');
    const plan = await this.plan(tenant, orgId);
    if (dryRun) return plan;
    return this.move(tenant, orgId, plan);
  }

  async finish(slug: string): Promise<void> {
    const tenant = await this.find(slug);
    const migration = await tenantTx(this.db, tenant.id, (tx) => getMigration(tx));
    if (tenant.tier !== 'enterprise' || !migration?.cutOverAt) {
      throw new ConflictProblem('This workspace has not been moved yet.');
    }
    if (migration.finishedAt) return;
    await this.bridges.forRealm(migration.realm).remove();
    await this.directory.deleteBridgeClient(tenant.slug);
    // Keycloak deletes the accounts an organization's company login made when it deletes the
    // organization; keep it while any of its people still belongs to another workspace.
    let organizationKept = false;
    for (const m of await this.directory.listMembers(migration.fromOrgId)) {
      const orgs = await this.directory.listUserOrganizations(m.kcUserId);
      if (orgs.some((o) => o.id !== migration.fromOrgId)) organizationKept = true;
    }
    if (!organizationKept) await this.directory.deleteOrganization(migration.fromOrgId);
    for (const app of ['web', 'portal'] as const) {
      await this.directory.removeTenantOrigin(tenantOrigin(tenant.slug, this.config, app), app);
    }
    await tenantTx(this.db, tenant.id, async (tx) => {
      await markFinished(tx);
      await insertAudit(tx, {
        ...OPS,
        action: 'tenant.migration_finished',
        target: tenant.id,
        metadata: { ...OPS.metadata, organizationKept },
      });
    });
  }

  async abort(slug: string): Promise<void> {
    const tenant = await this.find(slug);
    const migration = await tenantTx(this.db, tenant.id, (tx) => getMigration(tx));
    if (tenant.tier === 'enterprise' || migration?.cutOverAt) {
      throw new ConflictProblem('This move is past its cut-over and cannot be undone.');
    }
    if (!migration || migration.abortedAt) return;
    await this.provisioner.deleteRealm(migration.realm);
    await this.directory.deleteBridgeClient(tenant.slug);
    await tenantTx(this.db, tenant.id, async (tx) => {
      await markAborted(tx);
      await insertAudit(tx, {
        ...OPS,
        action: 'tenant.migration_aborted',
        target: tenant.id,
        metadata: { ...OPS.metadata },
      });
    });
    await platformRepository(this.db).setTenantStatus(tenant.id, 'active');
  }

  // A company login copied without its secret (linked before 5b): the operator gives it on stdin.
  async setIdpSecret(slug: string, alias: string, secret: string): Promise<void> {
    const tenant = await this.find(slug);
    if (tenant.tier !== 'enterprise' || !tenant.realm)
      throw new NotFoundProblem('No enterprise workspace at this address.');
    const realm = tenant.realm;
    const known = await tenantTx(this.db, tenant.id, (tx) => listIdps(tx));
    if (!known.some((idp) => idp.alias === alias))
      throw new NotFoundProblem(`${alias} is not a company login of ${slug}.`);
    await this.idps.forRealm(realm).setSecret(alias, secret);
    await this.secrets.put(idpSecretKey(alias), secret);
    await tenantTx(this.db, tenant.id, (tx) =>
      insertAudit(tx, {
        ...OPS,
        action: 'idp.secret_set',
        target: alias,
        metadata: { ...OPS.metadata, alias },
      }),
    );
  }

  private async plan(tenant: TenantRecord, orgId: string): Promise<MigrationPlan> {
    const people = await this.directory.listMembers(orgId);
    const { invites, logins } = await tenantTx(this.db, tenant.id, async (tx) => ({
      invites: await listOpenInvites(tx),
      logins: await listIdps(tx),
    }));
    return {
      slug: tenant.slug,
      realm: `ent-${tenant.slug}`,
      members: people.map((m) => ({
        email: m.email,
        role: m.group ? roleForGroupPath(`/${m.group}`) : null,
      })),
      invites: invites.length,
      companyLogins: await Promise.all(
        logins.map(async (idp) => ({
          alias: idp.alias,
          secretKept: (await this.secrets.get(idpSecretKey(idp.alias))) !== null,
        })),
      ),
    };
  }

  private async move(tenant: TenantRecord, orgId: string, plan: MigrationPlan): Promise<MigrationResult> {
    const realm = plan.realm;
    const issuer = `${this.config.authUrl}/realms/${realm}`;
    const platform = platformRepository(this.db);
    const platformIssuer = tenant.issuer ?? `${this.config.authUrl}/realms/${this.config.platformRealm}`;

    // 1. The freeze, and the row every later step checks.
    if (tenant.status !== 'migrating') {
      await platform.setTenantStatus(tenant.id, 'migrating');
      await tenantTx(this.db, tenant.id, async (tx) => {
        await startMigration(tx, { fromOrgId: orgId, realm });
        await insertAudit(tx, {
          ...OPS,
          action: 'tenant.migrating',
          target: tenant.id,
          metadata: { ...OPS.metadata, realm },
        });
      });
    } else {
      await tenantTx(this.db, tenant.id, (tx) => startMigration(tx, { fromOrgId: orgId, realm }));
    }

    // 2. The realm, built like every enterprise realm, with its permissions last (ADR-0026).
    // The realm being built is an enterprise realm, though the workspace stays Standard until the cut-over.
    const moving: TenantRecord & { realm: string } = { ...tenant, tier: 'enterprise', realm, issuer };
    await this.enterprise.buildRealm(tenant, realm);
    await this.enterprise.finishRealm(moving);

    // 3. The bridge: a platform client, and the provider that signs in through it.
    let bridgeSecret = await this.secrets.get(bridgeSecretKey(realm));
    if (!bridgeSecret) {
      bridgeSecret = randomBytes(32).toString('base64url');
      await this.secrets.put(bridgeSecretKey(realm), bridgeSecret);
    }
    await this.directory.ensureBridgeClient(
      tenant.slug,
      `${this.config.authUrl}/realms/${realm}/broker/${BRIDGE_ALIAS}/endpoint`,
      bridgeSecret,
    );
    const idps = this.idps.forRealm(realm);
    await this.bridges.forRealm(realm).ensure({ slug: tenant.slug, secret: bridgeSecret });

    // 4. Company logins, with the secret kept at link time when there is one.
    const waitingForSecret: string[] = [];
    const copied = new Set<string>();
    for (const { alias } of plan.companyLogins) {
      const settings = await this.directory.getIdentityProvider(alias);
      if (!settings) continue;
      const { enabled } = await idps.copy(settings, await this.secrets.get(idpSecretKey(alias)));
      copied.add(alias);
      if (!enabled) waitingForSecret.push(alias);
    }

    // 5. People: the same role, our same user id, and their old accounts linked.
    const members = await this.realmMembers.forRealm(realm);
    const owners: string[] = [];
    let people = 0;
    const seen = new Set<string>();
    for (const m of await this.directory.listMembers(orgId)) {
      seen.add(m.kcUserId);
      const user = await this.directory.getUser(m.kcUserId);
      const email = user?.email ?? m.email;
      if (!email) continue;
      const role = m.group ? roleForGroupPath(`/${m.group}`) : null;
      const { kcUserId } = await members.importMember({
        email,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        role,
      });
      const { userId } = await platform.upsertIdentity({
        issuer: platformIssuer,
        subject: m.kcUserId,
        email,
        displayName: m.displayName,
      });
      if (!(await platform.addIdentity({ userId, issuer, subject: kcUserId }))) {
        throw new ConflictProblem(`${email} already has another Tenantry account in ${realm}.`);
      }
      await idps.link(kcUserId, BRIDGE_ALIAS, { userId: m.kcUserId, userName: user?.username ?? email });
      for (const fed of await this.directory.listFederatedIdentities(m.kcUserId)) {
        if (copied.has(fed.alias))
          await idps.link(kcUserId, fed.alias, { userId: fed.userId, userName: fed.userName });
      }
      if (role === 'owner') owners.push(kcUserId);
      people++;
    }
    await this.consoles.forRealm(realm).protectOwners(owners);

    // 6. Open invites go out again from the new realm; their rows stay, as enterprise invites do.
    const invites = await tenantTx(this.db, tenant.id, (tx) => listOpenInvites(tx));
    for (const invite of invites) await members.invite(invite.email, invite.role);

    // 7. The cut-over: from here the guard accepts only the new realm's tokens for this workspace.
    // People who joined while it ran would be left behind: stop, and let a rerun take them too.
    if ((await this.directory.listMembers(orgId)).some((m) => !seen.has(m.kcUserId))) {
      throw new ConflictProblem('People joined the workspace during the move. Run it again.');
    }
    // One transaction: the new issuer, the tier, the stamp and the audit entry, or none of them.
    await tenantTx(this.db, tenant.id, async (tx) => {
      await cutOver(tx, tenant.id, { realm, issuer, templateVersion: TEMPLATE_VERSION });
      await insertAudit(tx, {
        ...OPS,
        action: 'tenant.migrated',
        target: tenant.id,
        metadata: { ...OPS.metadata, realm, people, invites: invites.length, companyLogins: copied.size },
      });
    });
    return { ...plan, cutOver: true, waitingForSecret };
  }

  private async find(slug: string): Promise<TenantRecord> {
    const tenant = await platformRepository(this.db).findTenantBySlug(slug);
    if (!tenant || !['active', 'migrating'].includes(tenant.status)) {
      throw new NotFoundProblem('No workspace at this address.');
    }
    return tenant;
  }
}
