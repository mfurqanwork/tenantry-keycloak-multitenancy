import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import { Ctx, CurrentTenant, SignedIn } from '../../auth/decorators.js';
import type { SignedInUser } from '../../auth/request-context.js';
import { NotificationsService } from './notifications.service.js';

// Every member of the workspace reads their own notifications; what each sees follows their role (spec 8.4).
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Ctx() ctx: TenantContext, @CurrentTenant() tenant: TenantRecord, @SignedIn() user: SignedInUser) {
    return this.notifications.list(ctx, tenant, user);
  }

  @Post('read')
  @HttpCode(204)
  async read(@Ctx() ctx: TenantContext, @CurrentTenant() tenant: TenantRecord): Promise<void> {
    await this.notifications.markRead(ctx, tenant);
  }
}
