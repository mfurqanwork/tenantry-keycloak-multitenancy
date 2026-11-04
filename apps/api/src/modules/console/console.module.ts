import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ConsoleController } from './console.controller.js';
import { ConsoleAccessService } from './console.service.js';

@Module({
  imports: [AuditModule],
  controllers: [ConsoleController],
  providers: [ConsoleAccessService],
  exports: [ConsoleAccessService],
})
export class ConsoleModule {}
