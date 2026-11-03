import { tenantOrigin } from '@tenantry/auth';
import { Inject, Injectable } from '@nestjs/common';
import { platformRepository, type Db, type TenantRecord } from '@tenantry/db';
import type { IdentityDirectory } from '@tenantry/keycloak-admin';
import type { SignedInUser } from '../../auth/request-context.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { DB, IDENTITY_DIRECTORY } from '../../infrastructure/tokens.js';

export interface WorkspaceView {
  slug: string;
  name: string;
  current: boolean;
  webUrl: string;
  portalUrl: string;
}

// The workspace switcher: Keycloak knows the person's organizations; our database knows which are live.
@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(IDENTITY_DIRECTORY) private readonly directory: IdentityDirectory,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(tenant: TenantRecord, user: SignedInUser): Promise<WorkspaceView[]> {
    // An enterprise account lives in one realm, so it belongs to this workspace only (README tier table).
    if (tenant.tier === 'enterprise') return [this.view(tenant, true)];
    const orgs = await this.directory.listUserOrganizations(user.kcUserId);
    const tenants = await platformRepository(this.db).findActiveTenantsBySlugs(orgs.map((o) => o.alias));
    return tenants.map((t) => this.view(t, t.id === tenant.id)).sort((x, y) => x.name.localeCompare(y.name));
  }

  private view(t: TenantRecord, current: boolean): WorkspaceView {
    return {
      slug: t.slug,
      name: t.name,
      current,
      webUrl: `${tenantOrigin(t.slug, this.config, 'web')}/`,
      portalUrl: `${tenantOrigin(t.slug, this.config, 'portal')}/`,
    };
  }
}
