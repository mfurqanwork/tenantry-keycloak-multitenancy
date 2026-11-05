import { Module } from '@nestjs/common';
import { ConsoleModule } from '../console/console.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { MembersController } from './members.controller.js';
import { MembersService } from './members.service.js';

@Module({
  imports: [ConsoleModule, AuditModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
