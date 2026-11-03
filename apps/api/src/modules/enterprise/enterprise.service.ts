import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { tenantOrigin } from '@tenantry/auth';
import { insertAudit, platformRepository, tenantTx, type Db, type TenantRecord } from '@tenantry/db';
import {
  loadProductClients,
  loadRealmTemplate,
  TEMPLATE_VERSION,
  type RealmProvisioner,
  type TemplateDiff,
  type TemplateVars,
} from '@tenantry/keycloak-admin';
import type { SecretStore } from '@tenantry/keycloak-admin/secrets';
import { ConflictProblem, NotFoundProblem, ValidationProblem } from '../../common/http-errors.js';
import { validateSlug } from '../../common/slug.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { backendSecretKey } from '../../infrastructure/member-directories.js';
import { DB, REALM_PROVISIONER, SECRET_STORE } from '../../infrastructure/tokens.js';

export interface ProvisionedTenant {
  slug: string;
  status: 'active';
  realm: string;
  webUrl: string;
  portalUrl: string;
}

export interface UpgradeResult {
  slug: string;
  realm: string;
  fromVersion: number | null;
  toVersion: number;
  differences: TemplateDiff[];
  applied: boolean;
  // Set when the realm could not be read; nothing was changed in it.
  error?: string;
}

// Operator changes have no person behind them; the audit entry says they came from the scripts.
const OPS = { actorUserId: null, metadata: { via: 'ops' } } as const;

// Enterprise tenants (ADR-0010): each its own realm, built from the versioned template by the
// create-realm-only provisioner. Every step can run again, so a failed run is finished by rerunning.
@Injectable()
export class EnterpriseService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REALM_PROVISIONER) private readonly provisioner: RealmProvisioner,
    @Inject(SECRET_STORE) private readonly secrets: SecretStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async provision(input: {
    slug: string;
    name: string;
    adminEmail: string;
  }): Promise<{ created: boolean; tenant: ProvisionedTenant }> {
    const check = validateSlug(input.slug);
    if (!check.ok) {
      throw new ValidationProblem(
        check.reason === 'reserved'
          ? 'That address is reserved.'
          : 'Use 3–32 lower-case letters, digits or dashes.',
      );
    }
    const platform = platformRepository(this.db);
    let tenant = await platform.findTenantBySlug(input.slug);
    if (tenant && tenant.tier !== 'enterprise')
      throw new ConflictProblem('A Standard workspace has that address.');
    if (tenant?.status === 'active') return { created: false, tenant: this.view(tenant) };

    // 1. Record intent (or resume the run that stopped).
    if (!tenant) {
      const { id } = await platform.insertProvisioningTenant({
        slug: input.slug,
        name: input.name,
        tier: 'enterprise',
      });
      await tenantTx(this.db, id, (tx) =>
        insertAudit(tx, {
          ...OPS,
          action: 'tenant.provisioning',
          target: id,
          metadata: { ...OPS.metadata, slug: input.slug, name: input.name },
        }),
      );
      tenant = await platform.findTenantById(id);
    }
    if (!tenant) throw new Error(`tenant ${input.slug} vanished`);
    const realm = `ent-${input.slug}`;
    const vars = this.vars(tenant);

    // 2–4. The realm, its template and our product clients.
    await this.provisioner.ensureRealm(realm);
    await this.provisioner.applyTemplate(realm, loadRealmTemplate(TEMPLATE_VERSION, vars));
    await this.provisioner.ensureClients(realm, loadProductClients(vars));
    // 5. The backend secret: made once, kept in the secrets store, never in Postgres (ADR-0023).
    const key = backendSecretKey(realm);
    let secret = await this.secrets.get(key);
    if (!secret) {
      secret = randomBytes(32).toString('base64url');
      await this.secrets.put(key, secret);
    }
    await this.provisioner.setBackendSecret(realm, secret);
    // 6. The first owner, with a set-password email.
    await this.provisioner.ensureFirstAdmin(realm, input.adminEmail, vars.webOrigin);
    // 7. The guard accepts this realm's tokens for this tenant from here on.
    await platform.registerIdentity(tenant.id, {
      realm,
      issuer: `${this.config.authUrl}/realms/${realm}`,
      kcOrgId: null,
      templateVersion: TEMPLATE_VERSION,
    });
    // 8–9. Smoke test, then open the doors.
    await this.provisioner.smokeTest(realm, secret);
    await tenantTx(this.db, tenant.id, async (tx) => {
      await platformRepository(tx).markTenantActive(tenant.id);
      await insertAudit(tx, {
        ...OPS,
        action: 'tenant.created',
        target: tenant.id,
        metadata: { ...OPS.metadata, slug: input.slug, realm, templateVersion: TEMPLATE_VERSION },
      });
    });
    return { created: true, tenant: this.view({ ...tenant, realm }) };
  }

  async upgrade(input: { slug?: string | undefined; dryRun: boolean }): Promise<UpgradeResult[]> {
    const platform = platformRepository(this.db);
    let tenants: TenantRecord[];
    if (input.slug) {
      const one = await platform.findTenantBySlug(input.slug);
      if (one?.tier !== 'enterprise' || one.status !== 'active' || !one.realm) {
        throw new NotFoundProblem('No enterprise workspace at this address.');
      }
      tenants = [one];
    } else {
      tenants = await platform.listActiveTenants({ tier: 'enterprise' });
    }
    const results: UpgradeResult[] = [];
    for (const tenant of tenants) {
      const realm = tenant.realm ?? `ent-${tenant.slug}`;
      const vars = this.vars(tenant);
      const template = loadRealmTemplate(TEMPLATE_VERSION, vars);
      const clients = loadProductClients(vars);
      let differences: TemplateDiff[];
      try {
        differences = await this.provisioner.diff(realm, template, clients);
      } catch (err) {
        // One unreachable realm must not stop the upgrade of the others; the operator sees why.
        results.push({
          slug: tenant.slug,
          realm,
          fromVersion: tenant.templateVersion,
          toVersion: TEMPLATE_VERSION,
          differences: [],
          applied: false,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      const outdated = tenant.templateVersion !== TEMPLATE_VERSION;
      const applied = !input.dryRun && (differences.length > 0 || outdated);
      if (applied) {
        await this.provisioner.applyTemplate(realm, template);
        await this.provisioner.ensureClients(realm, clients);
        await tenantTx(this.db, tenant.id, async (tx) => {
          await platformRepository(tx).setTemplateVersion(tenant.id, TEMPLATE_VERSION);
          await insertAudit(tx, {
            ...OPS,
            action: 'tenant.upgraded',
            target: tenant.id,
            metadata: {
              ...OPS.metadata,
              fromVersion: tenant.templateVersion,
              toVersion: TEMPLATE_VERSION,
              changed: differences.map((d) => d.path),
            },
          });
        });
      }
      results.push({
        slug: tenant.slug,
        realm,
        fromVersion: tenant.templateVersion,
        toVersion: TEMPLATE_VERSION,
        differences,
        applied,
      });
    }
    return results;
  }

  private vars(tenant: TenantRecord): TemplateVars {
    return {
      displayName: tenant.name,
      webOrigin: tenantOrigin(tenant.slug, this.config, 'web'),
      portalOrigin: tenantOrigin(tenant.slug, this.config, 'portal'),
      smtp: this.config.smtp,
      // Local development is served over http; everywhere else redirect URIs must be https.
      allowHttpRedirects: new URL(this.config.authUrl).protocol === 'http:',
    };
  }

  private view(tenant: TenantRecord): ProvisionedTenant {
    return {
      slug: tenant.slug,
      status: 'active',
      realm: tenant.realm ?? `ent-${tenant.slug}`,
      webUrl: `${tenantOrigin(tenant.slug, this.config, 'web')}/`,
      portalUrl: `${tenantOrigin(tenant.slug, this.config, 'portal')}/`,
    };
  }
}
