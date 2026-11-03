import { Controller, Get, Headers, Inject, Param } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import { Ctx, CurrentTenant, Public, SignedIn } from '../../auth/decorators.js';
import { tenantFromHost } from '../../auth/host.js';
import type { SignedInUser } from '../../auth/request-context.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { TenantsService } from './tenants.service.js';

@Controller()
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // Before login the SPA has only its hostname; this says which realm, client and organization to use.
  // The portal host gets the portal's client; any other host the web app's.
  @Get('tenants/:slug/auth-config')
  @Public()
  authConfig(@Param('slug') slug: string, @Headers('host') host: string | undefined) {
    return this.tenants.authConfig(slug, tenantFromHost(host, this.config.baseDomain)?.app ?? 'web');
  }

  @Get('me')
  me(@Ctx() ctx: TenantContext, @CurrentTenant() tenant: TenantRecord, @SignedIn() user: SignedInUser) {
    return {
      user: { id: user.userId, email: user.email, displayName: user.displayName },
      tenant: { slug: tenant.slug, name: tenant.name },
      role: ctx.roles[0] ?? null,
      permissions: [...ctx.permissions].sort(),
    };
  }
}
