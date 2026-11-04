import { Inject, Injectable } from '@nestjs/common';
import { SECURITY_DEFAULTS, tenantOrigin, type ScimDefaultRole } from '@tenantry/auth';
import {
  findActiveScimToken,
  getSecurity,
  insertScimToken,
  lockTenantScim,
  putSecurity,
  revokeScimTokens,
  tenantTx,
  type Db,
  type TenantRecord,
} from '@tenantry/db';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import type { RealmScimFactory } from '../../infrastructure/realm-scim.js';
import { DB, REALM_SCIM } from '../../infrastructure/tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { enterpriseOnly } from '../security/security.service.js';
import { newScimToken } from './tokens.js';

const DAY_MS = 86_400_000;

export interface ScimView {
  url: string;
  token: { expiresAt: string; lastUsedAt: string | null; createdAt: string } | null;
  defaultRole: ScimDefaultRole;
}

// A workspace's SCIM token (ADR-0024): one active at a time, shown once, kept as a hash. The first
// turns the realm's SCIM on; revoking the last turns it off.
@Injectable()
export class ScimTokensService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REALM_SCIM) private readonly realms: RealmScimFactory,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  async view(tenant: TenantRecord): Promise<ScimView> {
    enterpriseOnly(tenant);
    const [token, security] = await tenantTx(this.db, tenant.id, (tx) =>
      Promise.all([findActiveScimToken(tx), getSecurity(tx)]),
    );
    return {
      url: `${tenantOrigin(tenant.slug, this.config, 'web')}/scim/v2`,
      token: token && {
        expiresAt: token.expiresAt.toISOString(),
        lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
        createdAt: token.createdAt.toISOString(),
      },
      defaultRole: (security ?? SECURITY_DEFAULTS).scimDefaultRole,
    };
  }

  async generate(
    actor: { userId: string },
    tenant: TenantRecord,
    expiresInDays: number,
  ): Promise<{ token: string; expiresAt: string }> {
    enterpriseOnly(tenant);
    const scim = this.realms.forTenant(tenant);
    const { token, hash } = newScimToken();
    return tenantTx(this.db, tenant.id, async (tx) => {
      await lockTenantScim(tx);
      const row = await insertScimToken(tx, {
        tokenHash: hash,
        expiresAt: new Date(Date.now() + expiresInDays * DAY_MS),
        createdBy: actor.userId,
      });
      const expiresAt = row.expiresAt.toISOString();
      // Last before commit: if Keycloak refuses, no token is left that cannot be used.
      await scim.enable();
      await this.audit.record(tx, actor, 'scim.token_created', tenant.id, { expiresAt });
      return { token, expiresAt };
    });
  }

  async revoke(actor: { userId: string }, tenant: TenantRecord): Promise<void> {
    enterpriseOnly(tenant);
    const scim = this.realms.forTenant(tenant);
    await tenantTx(this.db, tenant.id, async (tx) => {
      await lockTenantScim(tx);
      const active = await findActiveScimToken(tx);
      if (!active) return;
      await revokeScimTokens(tx);
      await scim.disable();
      await this.audit.record(tx, actor, 'scim.token_revoked', tenant.id, {
        expiresAt: active.expiresAt.toISOString(),
      });
    });
  }

  async setDefaultRole(
    actor: { userId: string },
    tenant: TenantRecord,
    role: ScimDefaultRole,
  ): Promise<ScimView> {
    enterpriseOnly(tenant);
    await tenantTx(this.db, tenant.id, async (tx) => {
      const before = (await getSecurity(tx)) ?? SECURITY_DEFAULTS;
      // Only our record changes: the gateway reads the role, the realm does not hold it.
      await putSecurity(tx, { ...before, scimDefaultRole: role }, actor.userId);
      await this.audit.record(tx, actor, 'security.updated', tenant.id, {
        before: { scimDefaultRole: before.scimDefaultRole },
        after: { scimDefaultRole: role },
      });
    });
    return this.view(tenant);
  }
}
