import { Controller, Get, Headers, Inject, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../auth/decorators.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { BrandingService } from './branding.service.js';

// Read before anyone signs in: by the apps, and by the Keycloak login page on the auth origin.
@Controller('tenants/:slug')
export class PublicBrandingController {
  constructor(
    private readonly branding: BrandingService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // Only the login page's origin may read this cross-origin; it is a plain GET, so no preflight.
  @Get('branding')
  @Public()
  async get(
    @Param('slug') slug: string,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.vary('Origin');
    if (origin === new URL(this.config.authUrl).origin) res.setHeader('Access-Control-Allow-Origin', origin);
    return this.branding.publicBranding(slug);
  }

  @Get('logo')
  @Public()
  async logo(@Param('slug') slug: string, @Query('v') v: string | undefined, @Res() res: Response) {
    const { logo, version } = await this.branding.logo(slug);
    res
      .type(logo.contentType)
      .setHeader('X-Content-Type-Options', 'nosniff')
      .setHeader(
        'Cache-Control',
        version !== null && v === String(version) ? 'public, max-age=31536000, immutable' : 'no-cache',
      )
      .send(logo.bytes);
  }
}
