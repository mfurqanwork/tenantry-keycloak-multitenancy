import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { BrandingController } from './branding.controller.js';
import { BrandingService } from './branding.service.js';
import { PublicBrandingController } from './public-branding.controller.js';

@Module({
  imports: [AuditModule],
  controllers: [BrandingController, PublicBrandingController],
  providers: [BrandingService],
})
export class BrandingModule {}
