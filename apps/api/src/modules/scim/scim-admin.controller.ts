import { Body, Controller, Delete, Get, HttpCode, Post, Put } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import { Ctx, CurrentTenant, RequirePermission } from '../../auth/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { defaultRoleBody, tokenBody, type DefaultRoleBody, type TokenBody } from './scim.schemas.js';
import { ScimTokensService } from './scim-tokens.service.js';

// Owners manage their workspace's directory sync (tenant:settings); the sync itself is /scim/v2.
@Controller('scim')
export class ScimAdminController {
  constructor(private readonly tokens: ScimTokensService) {}

  @Get()
  @RequirePermission('tenant:settings')
  view(@CurrentTenant() tenant: TenantRecord) {
    return this.tokens.view(tenant);
  }

  @Post('token')
  @RequirePermission('tenant:settings')
  generate(
    @Ctx() ctx: TenantContext,
    @CurrentTenant() tenant: TenantRecord,
    @Body(new ZodPipe(tokenBody)) body: TokenBody,
  ) {
    return this.tokens.generate({ userId: ctx.userId }, tenant, body.expiresInDays);
  }

  @Delete('token')
  @HttpCode(204)
  @RequirePermission('tenant:settings')
  revoke(@Ctx() ctx: TenantContext, @CurrentTenant() tenant: TenantRecord) {
    return this.tokens.revoke({ userId: ctx.userId }, tenant);
  }

  @Put('default-role')
  @RequirePermission('tenant:settings')
  setDefaultRole(
    @Ctx() ctx: TenantContext,
    @CurrentTenant() tenant: TenantRecord,
    @Body(new ZodPipe(defaultRoleBody)) body: DefaultRoleBody,
  ) {
    return this.tokens.setDefaultRole({ userId: ctx.userId }, tenant, body.role);
  }
}
