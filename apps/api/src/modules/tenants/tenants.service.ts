import { Inject, Injectable } from '@nestjs/common';
import type { TenantApp } from '@tenantry/auth';
import { platformRepository, type Db } from '@tenantry/db';
import { NotFoundProblem } from '../../common/http-errors.js';
import { DB } from '../../infrastructure/tokens.js';

export interface AuthConfig {
  issuer: string;
  clientId: string;
  organization: string;
}

// Each app signs in through its own public client (ADR-0020).
export const CLIENT_IDS: Record<TenantApp, string> = { web: 'tenantry-web', portal: 'tenantry-portal' };

@Injectable()
export class TenantsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async authConfig(slug: string, app: TenantApp): Promise<AuthConfig> {
    const tenant = await platformRepository(this.db).findTenantBySlug(slug.toLowerCase());
    if (tenant?.status !== 'active' || !tenant.issuer) {
      throw new NotFoundProblem('No workspace at this address.');
    }
    return { issuer: tenant.issuer, clientId: CLIENT_IDS[app], organization: tenant.slug };
  }
}
