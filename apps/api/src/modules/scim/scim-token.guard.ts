import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import {
  findScimTokenByHash,
  platformRepository,
  tenantTx,
  touchScimToken,
  type Db,
  type TenantRecord,
} from '@tenantry/db';
import type { Request } from 'express';
import { slugFromHost } from '../../auth/host.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { DB } from '../../infrastructure/tokens.js';
import { ScimError } from './scim-errors.js';
import { bearerToken } from './scim-gateway.service.js';
import { hashScimToken } from './tokens.js';

export type ScimRequest = Request & { scimTenant?: TenantRecord };

const NO_TOKEN = 'A valid SCIM token for this workspace is required.';

// The only way into /scim/v2 (ADR-0024). The host picks the workspace; its token is looked up only
// inside that workspace, so another workspace's token is unknown here. Never TenantAuthGuard.
@Injectable()
export class ScimTokenGuard implements CanActivate {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ScimRequest>();
    const slug = slugFromHost(req.headers.host, this.config.baseDomain);
    const tenant = slug ? await platformRepository(this.db).findTenantBySlug(slug) : null;
    if (tenant?.tier !== 'enterprise' || tenant.status !== 'active' || !tenant.realm || !tenant.issuer) {
      throw new ScimError(404, 'No enterprise workspace at this address.');
    }
    const token = bearerToken(req.headers.authorization);
    if (!token?.startsWith('tnt_scim_')) throw new ScimError(401, NO_TOKEN);
    const valid = await tenantTx(this.db, tenant.id, async (tx) => {
      const found = await findScimTokenByHash(tx, hashScimToken(token));
      if (!found || found.revokedAt || found.expiresAt.getTime() <= Date.now()) return false;
      await touchScimToken(tx, found.id);
      return true;
    });
    if (!valid) throw new ScimError(401, NO_TOKEN);
    req.scimTenant = tenant;
    return true;
  }
}
