import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OperatorOnly } from '../../auth/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { provisionBody, upgradeBody, type ProvisionBody, type UpgradeBody } from './enterprise.schemas.js';
import { EnterpriseService } from './enterprise.service.js';

// The operator scripts provision and upgrade enterprise realms here (pnpm ops enterprise ...).
@Controller('platform/enterprise-tenants')
export class EnterpriseController {
  constructor(private readonly enterprise: EnterpriseService) {}

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
}
