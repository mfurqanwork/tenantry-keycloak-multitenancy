import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { EnterpriseModule } from '../enterprise/enterprise.module.js';
import { SecurityController } from './security.controller.js';
import { SecurityService } from './security.service.js';

@Module({
  imports: [AuditModule, EnterpriseModule],
  controllers: [SecurityController],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}
