import { Module } from '@nestjs/common';
import { AppsModule } from '../apps/apps.module.js';
import { EnterpriseController } from './enterprise.controller.js';
import { EnterpriseService } from './enterprise.service.js';

@Module({
  imports: [AppsModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService],
})
export class EnterpriseModule {}
