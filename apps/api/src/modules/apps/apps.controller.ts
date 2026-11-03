import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import { Ctx, CurrentTenant, RequirePermission } from '../../auth/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import {
  appBody,
  appPatchShape,
  tokenCheckBody,
  type AppBody,
  type AppPatchBody,
  type TokenCheckBody,
} from './apps.schemas.js';
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

  @Patch(':id')
  @RequirePermission('apps:register')
  update(
    @Ctx() ctx: TenantContext,
    @CurrentTenant() tenant: TenantRecord,
    @Param('id') id: string,
    @Body(new ZodPipe(appPatchShape)) body: AppPatchBody,
  ) {
    return this.apps.update(tenant, id, body, { userId: ctx.userId });
  }

  @Post(':id/secret')
  @HttpCode(200)
  @RequirePermission('apps:register')
  rotateSecret(@Ctx() ctx: TenantContext, @CurrentTenant() tenant: TenantRecord, @Param('id') id: string) {
    return this.apps.rotateSecret(tenant, id, { userId: ctx.userId });
  }

  @Post(':id/token-check')
  @HttpCode(200)
  @RequirePermission('apps:register')
  checkToken(
    @Ctx() ctx: TenantContext,
    @CurrentTenant() tenant: TenantRecord,
    @Param('id') id: string,
    @Body(new ZodPipe(tokenCheckBody)) body: TokenCheckBody,
  ) {
    return this.apps.checkToken(tenant, id, body.clientSecret, { userId: ctx.userId });
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('apps:register')
  remove(@Ctx() ctx: TenantContext, @CurrentTenant() tenant: TenantRecord, @Param('id') id: string) {
    return this.apps.remove(tenant, id, { userId: ctx.userId });
  }
}
