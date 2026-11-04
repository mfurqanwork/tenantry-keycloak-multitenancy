import { Module } from '@nestjs/common';
import { ConsoleModule } from '../console/console.module.js';
import { AppsModule } from '../apps/apps.module.js';
import { EnterpriseController } from './enterprise.controller.js';
import { EnterpriseService } from './enterprise.service.js';

@Module({
  imports: [ConsoleModule, AppsModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService],
  exports: [EnterpriseService],
})
export class EnterpriseModule {}
