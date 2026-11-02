import { Controller, Get, Param } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import { Ctx, CurrentTenant, Public, SignedIn } from '../../auth/decorators.js';
import type { SignedInUser } from '../../auth/request-context.js';
import { TenantsService } from './tenants.service.js';

@Controller()
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  // Before login the SPA has only its hostname; this says which realm and organization to use.
  @Get('tenants/:slug/auth-config')
  @Public()
  authConfig(@Param('slug') slug: string) {
    return this.tenants.authConfig(slug);
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
