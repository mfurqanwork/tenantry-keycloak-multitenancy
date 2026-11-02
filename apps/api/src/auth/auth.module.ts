import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InviteClaimer } from './invite-claimer.js';
import { TenantAuthGuard } from './tenant-auth.guard.js';

// Every route passes TenantAuthGuard unless it says @Public() or @SignedInOnly().
@Module({
  providers: [InviteClaimer, { provide: APP_GUARD, useClass: TenantAuthGuard }],
})
export class AuthModule {}
