import { Inject, Injectable, Logger } from '@nestjs/common';
import { SECURITY_DEFAULTS, tenantOrigin } from '@tenantry/auth';
import { getSecurity, tenantTx, type Db, type TenantRecord } from '@tenantry/db';
import { DirectoryError, type ScimResponse } from '@tenantry/keycloak-admin';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import type { RealmScimFactory } from '../../infrastructure/realm-scim.js';
import { DB, REALM_SCIM } from '../../infrastructure/tokens.js';
import { AuditService, type AuditAction } from '../audit/audit.service.js';
import { ScimError } from './scim-errors.js';

// The scheme is case-insensitive (RFC 7235); anything but Bearer is no token at all.
export function bearerToken(header: string | undefined): string | null {
  const match = /^\s*bearer\s+(\S+)\s*$/i.exec(header ?? '');
  return match?.[1] ?? null;
}

const isFalse = (v: unknown) => v === false || (typeof v === 'string' && v.toLowerCase() === 'false');

// A PUT with active false, or a PATCH that sets it: Entra sends the string "False", Okta a value object.
export function isDeactivation(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as { active?: unknown; Operations?: unknown };
  if (isFalse(b.active)) return true;
  if (!Array.isArray(b.Operations)) return false;
  return (b.Operations as { path?: unknown; value?: unknown }[]).some((op) => {
    if (typeof op.path === 'string') return op.path.toLowerCase() === 'active' && isFalse(op.value);
    return (
      typeof op.value === 'object' && op.value !== null && isFalse((op.value as { active?: unknown }).active)
    );
  });
}

// Keycloak names its own address in Location and meta.location; the directory should see ours.
export function rewriteLocation(text: string, from: string, to: string): string {
  return text.split(from).join(to);
}

export interface GatewayCall {
  method: string;
  path: string;
  query: string;
  body?: Buffer;
  contentType?: string;
}

const SCIM_ACTOR = { userId: null };
const VIA = { via: 'scim' } as const;

// Forwards one directory call to the realm's native SCIM, then does what Keycloak does not: the
// default role, the mapped groups kept, and the audit (ADR-0024).
@Injectable()
export class ScimGatewayService {
  private readonly logger = new Logger('ScimGateway');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REALM_SCIM) private readonly realms: RealmScimFactory,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  async handle(tenant: TenantRecord, call: GatewayCall): Promise<ScimResponse> {
    const scim = this.realms.forTenant(tenant);
    const [kind, id] = call.path.split('/');
    try {
      // The mapped groups give roles: a directory's delete empties one and keeps the mapping.
      if (call.method === 'DELETE' && kind === 'Groups' && id && (await scim.isMappedGroup(id))) {
        await scim.emptyGroup(id);
        await this.record(tenant, 'scim.group_changed', id, { emptied: true });
        return { status: 204, headers: {}, body: Buffer.alloc(0) };
      }
      const res = await scim.forward(call);
      if (res.status < 300) await this.after(tenant, call, kind, id, res);
      return this.rewrite(tenant, res);
    } catch (err) {
      if (err instanceof DirectoryError) {
        this.logger.error(err);
        throw new ScimError(502, 'The identity service is unavailable. Try again shortly.');
      }
      throw err;
    }
  }

  private async after(
    tenant: TenantRecord,
    call: GatewayCall,
    kind: string | undefined,
    id: string | undefined,
    res: ScimResponse,
  ): Promise<void> {
    if (call.method === 'GET') return;
    if (kind === 'Groups') {
      const target = id ?? this.idOf(res) ?? 'unknown';
      await this.record(tenant, 'scim.group_changed', target, { method: call.method });
      return;
    }
    if (kind !== 'Users') return;
    const target = id ?? this.idOf(res);
    if (!target) return;
    if (call.method === 'DELETE') {
      await this.record(tenant, 'scim.user_deactivated', target, { deleted: true });
      return;
    }
    const body = this.json(call.body);
    if (isDeactivation(body)) {
      await this.record(tenant, 'scim.user_deactivated', target, {});
      return;
    }
    await this.record(tenant, call.method === 'POST' ? 'scim.user_created' : 'scim.user_updated', target, {});
    await this.grantDefaultRole(tenant, target);
  }

  // Idempotent, so a failed grant is put right by the directory's next call for that person.
  private async grantDefaultRole(tenant: TenantRecord, kcUserId: string): Promise<void> {
    const security = await tenantTx(this.db, tenant.id, (tx) => getSecurity(tx));
    if ((security ?? SECURITY_DEFAULTS).scimDefaultRole !== 'member') return;
    try {
      await this.realms.forTenant(tenant).grantRole(kcUserId, 'member');
    } catch (err) {
      this.logger.error(err);
      await this.record(tenant, 'scim.role_grant_failed', kcUserId, {});
    }
  }

  private rewrite(tenant: TenantRecord, res: ScimResponse): ScimResponse {
    const from = `${tenant.issuer ?? ''}/scim/v2`;
    const to = `${tenantOrigin(tenant.slug, this.config, 'web')}/scim/v2`;
    const headers = { ...res.headers };
    if (headers['location']) headers['location'] = rewriteLocation(headers['location'], from, to);
    const json = /json/.test(headers['content-type'] ?? '');
    const body = json ? Buffer.from(rewriteLocation(res.body.toString('utf8'), from, to)) : res.body;
    return { ...res, headers, body };
  }

  private idOf(res: ScimResponse): string | null {
    const body = this.json(res.body) as { id?: unknown } | null;
    return typeof body?.id === 'string' ? body.id : null;
  }

  private json(bytes: Buffer | undefined): unknown {
    if (!bytes?.length) return null;
    try {
      return JSON.parse(bytes.toString('utf8')) as unknown;
    } catch {
      return null;
    }
  }

  // No person acts: the directory does. Target is the Keycloak id; no attributes of the person.
  private record(
    tenant: TenantRecord,
    action: AuditAction,
    target: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    return tenantTx(this.db, tenant.id, (tx) =>
      this.audit.record(tx, SCIM_ACTOR, action, target, { ...VIA, ...metadata }),
    );
  }
}
