import { Body, Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OperatorOnly } from '../../auth/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { provisionBody, upgradeBody, type ProvisionBody, type UpgradeBody } from './enterprise.schemas.js';
import { appBody, AppsService, type AppBody } from '../apps/apps.service.js';
import { EnterpriseService } from './enterprise.service.js';

const OPS = { userId: null, via: 'ops' } as const;

// The operator scripts provision and upgrade enterprise realms here (pnpm ops enterprise ...).
@Controller('platform/enterprise-tenants')
export class EnterpriseController {
  constructor(
    private readonly enterprise: EnterpriseService,
    private readonly apps: AppsService,
  ) {}

  // 201 when this call finished the tenant; 200 when it was already active.
  @Post()
  @OperatorOnly()
  async provision(
    @Body(new ZodPipe(provisionBody)) body: ProvisionBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, tenant } = await this.enterprise.provision(body);
    res.status(created ? 201 : 200);
    return tenant;
  }

  @Post('upgrade')
  @HttpCode(200)
  @OperatorOnly()
  upgrade(@Body(new ZodPipe(upgradeBody)) body: UpgradeBody) {
    return this.enterprise.upgrade(body);
  }

  // Customer apps by operator (pnpm ops apps; the seed's demo app), audited as coming from ops.
  @Get(':slug/apps')
  @OperatorOnly()
  async listApps(@Param('slug') slug: string) {
    return this.apps.list(await this.enterprise.activeEnterprise(slug));
  }

  @Post(':slug/apps')
  @OperatorOnly()
  async registerApp(@Param('slug') slug: string, @Body(new ZodPipe(appBody)) body: AppBody) {
    return this.apps.register(await this.enterprise.activeEnterprise(slug), body, OPS);
  }

  @Post(':slug/apps/:id/secret')
  @HttpCode(200)
  @OperatorOnly()
  async rotateAppSecret(@Param('slug') slug: string, @Param('id') id: string) {
    return this.apps.rotateSecret(await this.enterprise.activeEnterprise(slug), id, OPS);
  }
}
