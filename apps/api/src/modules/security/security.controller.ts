import { Body, Controller, Get, Put } from '@nestjs/common';
import type { SecuritySettings, TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import { Ctx, CurrentTenant, RequirePermission } from '../../auth/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { securityBody } from './security.schemas.js';
import { SecurityService } from './security.service.js';

// Owners set their enterprise realm's sign-in rules (tenant:settings).
@Controller('security')
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get()
  @RequirePermission('tenant:settings')
  get(@CurrentTenant() tenant: TenantRecord) {
    return this.security.get(tenant);
  }

  @Put()
  @RequirePermission('tenant:settings')
  put(
    @Ctx() ctx: TenantContext,
    @CurrentTenant() tenant: TenantRecord,
    @Body(new ZodPipe(securityBody)) body: SecuritySettings,
  ) {
    return this.security.put({ userId: ctx.userId }, tenant, body);
  }
}
