import { Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import { Ctx, CurrentTenant, RequirePermission } from '../../auth/decorators.js';
import { ConsoleAccessService } from './console.service.js';

// Owners let admins of their own into the realm's Keycloak console (tenant:settings), ADR-0026.
@Controller('members/:userId/console')
export class ConsoleController {
  constructor(private readonly console: ConsoleAccessService) {}

  @Post()
  @HttpCode(204)
  @RequirePermission('tenant:settings')
  grant(@Ctx() ctx: TenantContext, @CurrentTenant() tenant: TenantRecord, @Param('userId') userId: string) {
    return this.console.grant(ctx, tenant, userId);
  }

  @Delete()
  @HttpCode(204)
  @RequirePermission('tenant:settings')
  revoke(@Ctx() ctx: TenantContext, @CurrentTenant() tenant: TenantRecord, @Param('userId') userId: string) {
    return this.console.revoke(ctx, tenant, userId);
  }
}
