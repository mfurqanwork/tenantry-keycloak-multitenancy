import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import { Ctx, CurrentTenant, RequirePermission, SignedIn } from '../../auth/decorators.js';
import type { SignedInUser } from '../../auth/request-context.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { changeRoleBody, inviteBody, type ChangeRoleBody, type InviteBody } from './members.schemas.js';
import { MembersService } from './members.service.js';

@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequirePermission('members:read')
  list(@Ctx() ctx: TenantContext, @CurrentTenant() tenant: TenantRecord) {
    return this.members.list(ctx, tenant);
  }

  @Post('invites')
  @RequirePermission('members:invite')
  invite(
    @Ctx() ctx: TenantContext,
    @CurrentTenant() tenant: TenantRecord,
    @SignedIn() user: SignedInUser,
    @Body(new ZodPipe(inviteBody)) body: InviteBody,
  ) {
    return this.members.invite(ctx, tenant, user, body);
  }

  @Delete('invites/:id')
  @HttpCode(204)
  @RequirePermission('members:invite')
  revoke(
    @Ctx() ctx: TenantContext,
    @CurrentTenant() tenant: TenantRecord,
    @SignedIn() user: SignedInUser,
    @Param('id') id: string,
  ) {
    return this.members.revokeInvite(ctx, tenant, user, id);
  }

  @Patch(':userId')
  @RequirePermission('members:change-role')
  async changeRole(
    @Ctx() ctx: TenantContext,
    @CurrentTenant() tenant: TenantRecord,
    @SignedIn() user: SignedInUser,
    @Param('userId') userId: string,
    @Body(new ZodPipe(changeRoleBody)) body: ChangeRoleBody,
  ) {
    await this.members.changeRole(ctx, tenant, user, userId, body.role);
    return { userId, role: body.role };
  }

  @Delete(':userId')
  @HttpCode(204)
  @RequirePermission('members:remove')
  remove(
    @Ctx() ctx: TenantContext,
    @CurrentTenant() tenant: TenantRecord,
    @SignedIn() user: SignedInUser,
    @Param('userId') userId: string,
  ) {
    return this.members.remove(ctx, tenant, user, userId);
  }
}
