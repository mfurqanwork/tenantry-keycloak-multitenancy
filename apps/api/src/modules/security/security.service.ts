import { Inject, Injectable } from '@nestjs/common';
import { SECURITY_DEFAULTS, type SecuritySettings } from '@tenantry/auth';
import { getSecurity, putSecurity, tenantTx, type Db, type TenantRecord } from '@tenantry/db';
import { DirectoryError, type RealmProvisioner } from '@tenantry/keycloak-admin';
import { NotFoundProblem, ValidationProblem } from '../../common/http-errors.js';
import { DB, REALM_PROVISIONER } from '../../infrastructure/tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { EnterpriseService } from '../enterprise/enterprise.service.js';

export const ENTERPRISE_ONLY = 'Security settings and SCIM are available on Enterprise workspaces.';

// An enterprise realm's sign-in rules (Phase 5a). Our row is the record; the realm is set from it in
// the same request, and the row is not written when Keycloak refuses.
@Injectable()
export class SecurityService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REALM_PROVISIONER) private readonly provisioner: RealmProvisioner,
    private readonly enterprise: EnterpriseService,
    private readonly audit: AuditService,
  ) {}

  async get(tenant: TenantRecord): Promise<SecuritySettings> {
    enterpriseOnly(tenant);
    return (await tenantTx(this.db, tenant.id, (tx) => getSecurity(tx))) ?? SECURITY_DEFAULTS;
  }

  async put(
    actor: { userId: string },
    tenant: TenantRecord,
    settings: SecuritySettings,
  ): Promise<SecuritySettings> {
    enterpriseOnly(tenant);
    const realm = tenant.realm ?? `ent-${tenant.slug}`;
    const { secondStep } = await this.enterprise.templateFor(tenant);
    try {
      return await tenantTx(this.db, tenant.id, async (tx) => {
        const before = (await getSecurity(tx)) ?? SECURITY_DEFAULTS;
        await putSecurity(tx, settings, actor.userId);
        // Last before commit: a refusal rolls the row back.
        await this.provisioner.applySecurity(realm, settings, secondStep);
        await this.audit.record(tx, actor, 'security.updated', tenant.id, { before, after: settings });
        return settings;
      });
    } catch (err) {
      if (err instanceof DirectoryError && err.status === 400) {
        throw new ValidationProblem(`Keycloak refused these settings: ${err.detail ?? 'no detail'}`);
      }
      throw err;
    }
  }
}

export function enterpriseOnly(tenant: TenantRecord): void {
  if (tenant.tier !== 'enterprise') throw new NotFoundProblem(ENTERPRISE_ONLY);
}
