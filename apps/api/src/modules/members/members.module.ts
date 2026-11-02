import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { MembersController } from './members.controller.js';
import { MembersService } from './members.service.js';

@Module({
  imports: [AuditModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
