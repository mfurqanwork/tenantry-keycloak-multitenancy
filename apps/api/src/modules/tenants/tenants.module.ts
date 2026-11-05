import { Module } from '@nestjs/common';
import { ConsoleModule } from '../console/console.module.js';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';

@Module({
  imports: [ConsoleModule],
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
