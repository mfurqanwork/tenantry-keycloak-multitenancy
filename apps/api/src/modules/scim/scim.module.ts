import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ScimAdminController } from './scim-admin.controller.js';
import { ScimTokensService } from './scim-tokens.service.js';

@Module({
  imports: [AuditModule],
  controllers: [ScimAdminController],
  providers: [ScimTokensService],
  exports: [ScimTokensService],
})
export class ScimModule {}
