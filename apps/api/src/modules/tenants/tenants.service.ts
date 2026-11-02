import { Inject, Injectable } from '@nestjs/common';
import { platformRepository, type Db } from '@tenantry/db';
import { NotFoundProblem } from '../../common/http-errors.js';
import { DB } from '../../infrastructure/tokens.js';

export interface AuthConfig {
  issuer: string;
  clientId: string;
  organization: string;
}

export const WEB_CLIENT_ID = 'tenantry-web';

@Injectable()
export class TenantsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async authConfig(slug: string): Promise<AuthConfig> {
    const tenant = await platformRepository(this.db).findTenantBySlug(slug.toLowerCase());
    if (tenant?.status !== 'active' || !tenant.issuer)
      throw new NotFoundProblem('No workspace at this address.');
    return { issuer: tenant.issuer, clientId: WEB_CLIENT_ID, organization: tenant.slug };
  }
}
