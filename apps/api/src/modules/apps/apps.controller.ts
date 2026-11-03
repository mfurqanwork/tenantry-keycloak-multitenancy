import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import { Ctx, CurrentTenant, RequirePermission } from '../../auth/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { appBody, type AppBody } from './apps.schemas.js';
import { AppsService } from './apps.service.js';

@Controller('apps')
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  @Get()
  @RequirePermission('apps:read')
  list(@CurrentTenant() tenant: TenantRecord) {
    return this.apps.list(tenant);
  }

  @Get(':id')
  @RequirePermission('apps:read')
  get(@CurrentTenant() tenant: TenantRecord, @Param('id') id: string) {
    return this.apps.get(tenant, id);
  }

  @Post()
  @RequirePermission('apps:register')
  register(
    @Ctx() ctx: TenantContext,
    @CurrentTenant() tenant: TenantRecord,
    @Body(new ZodPipe(appBody)) body: AppBody,
  ) {
    return this.apps.register(tenant, body, { userId: ctx.userId });
  }
}
