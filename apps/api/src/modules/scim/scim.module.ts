import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ScimAdminController } from './scim-admin.controller.js';
import { ScimGatewayController } from './scim-gateway.controller.js';
import { ScimGatewayService } from './scim-gateway.service.js';
import { ScimTokenGuard } from './scim-token.guard.js';
import { ScimTokensService } from './scim-tokens.service.js';

@Module({
  imports: [AuditModule],
  controllers: [ScimAdminController, ScimGatewayController],
  providers: [ScimTokensService, ScimGatewayService, ScimTokenGuard],
  exports: [ScimTokensService],
})
export class ScimModule {}
