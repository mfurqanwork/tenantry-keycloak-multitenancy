import { Body, Controller, Delete, HttpCode, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import { Ctx, CurrentTenant, RequirePermission } from '../../auth/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { brandingBody, LOGO_MAX_BYTES, type BrandingBody } from './branding.schemas.js';
import { BrandingService } from './branding.service.js';

// Owners set the workspace's colour and logo (tenant:settings).
@Controller('branding')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Put()
  @RequirePermission('tenant:settings')
  setColor(
    @Ctx() ctx: TenantContext,
    @CurrentTenant() tenant: TenantRecord,
    @Body(new ZodPipe(brandingBody)) body: BrandingBody,
  ) {
    return this.branding.setColor(ctx, tenant, body.primaryColor);
  }

  // Multer stops reading past the limit and answers 413.
  @Post('logo')
  @RequirePermission('tenant:settings')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LOGO_MAX_BYTES, files: 1 } }))
  setLogo(
    @Ctx() ctx: TenantContext,
    @CurrentTenant() tenant: TenantRecord,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.branding.setLogo(ctx, tenant, file?.buffer);
  }

  @Delete('logo')
  @HttpCode(204)
  @RequirePermission('tenant:settings')
  removeLogo(@Ctx() ctx: TenantContext, @CurrentTenant() tenant: TenantRecord) {
    return this.branding.removeLogo(ctx, tenant);
  }
}
