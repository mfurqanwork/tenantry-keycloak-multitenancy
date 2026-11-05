import { Inject, Injectable } from '@nestjs/common';
import { isOpen } from '../../common/migrating.js';
import type { TenantApp } from '@tenantry/auth';
import { platformRepository, type Db } from '@tenantry/db';
import { NotFoundProblem } from '../../common/http-errors.js';
import { DB } from '../../infrastructure/tokens.js';

export interface AuthConfig {
  issuer: string;
  clientId: string;
  // The organization to sign in to; null for an enterprise tenant, whose realm is the tenant.
  organization: string | null;
}

// Each app signs in through its own public client (ADR-0020).
export const CLIENT_IDS: Record<TenantApp, string> = { web: 'tenantry-web', portal: 'tenantry-portal' };

@Injectable()
export class TenantsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async authConfig(slug: string, app: TenantApp): Promise<AuthConfig> {
    const tenant = await platformRepository(this.db).findTenantBySlug(slug.toLowerCase());
    if (!tenant || !isOpen(tenant.status) || !tenant.issuer) {
      throw new NotFoundProblem('No workspace at this address.');
    }
    return {
      issuer: tenant.issuer,
      clientId: CLIENT_IDS[app],
      organization: tenant.tier === 'enterprise' ? null : tenant.slug,
    };
  }
}
