import { Module } from '@nestjs/common';
import { ConsoleModule } from '../console/console.module.js';
import { AppsModule } from '../apps/apps.module.js';
import { EnterpriseController } from './enterprise.controller.js';
import { EnterpriseService } from './enterprise.service.js';
import { MigrationService } from './migration.service.js';

@Module({
  imports: [ConsoleModule, AppsModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService, MigrationService],
  exports: [EnterpriseService],
})
export class EnterpriseModule {}
