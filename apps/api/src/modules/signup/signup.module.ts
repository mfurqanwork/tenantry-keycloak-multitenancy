import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { SignupController } from './signup.controller.js';
import { SignupService } from './signup.service.js';

@Module({
  imports: [AuditModule],
  controllers: [SignupController],
  providers: [SignupService],
})
export class SignupModule {}
