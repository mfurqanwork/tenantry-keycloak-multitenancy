import { Body, Controller, Get, HttpCode, Param, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OperatorOnly } from '../../auth/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { provisionBody, upgradeBody, type ProvisionBody, type UpgradeBody } from './enterprise.schemas.js';
import { appBody, AppsService, type AppBody } from '../apps/apps.service.js';
import { EnterpriseService } from './enterprise.service.js';
import {
  idpSecretBody,
  migrateBody,
  slugBody,
  type IdpSecretBody,
  type MigrateBody,
  type SlugBody,
} from './migration.schemas.js';
import { MigrationService } from './migration.service.js';

const OPS = { userId: null, via: 'ops' } as const;

// The operator scripts provision and upgrade enterprise realms here (pnpm ops enterprise ...).
@Controller('platform/enterprise-tenants')
export class EnterpriseController {
  constructor(
    private readonly enterprise: EnterpriseService,
    private readonly apps: AppsService,
    private readonly migration: MigrationService,
  ) {}

  // Moving a Standard workspace into its own realm (ADR-0025): pnpm ops enterprise migrate.
  @Post('migrate')
  @HttpCode(200)
  @OperatorOnly()
  migrate(@Body(new ZodPipe(migrateBody)) body: MigrateBody) {
    return this.migration.migrate(body.slug, body.dryRun);
  }

  @Post('migrate/finish')
  @HttpCode(204)
  @OperatorOnly()
  finish(@Body(new ZodPipe(slugBody)) body: SlugBody) {
    return this.migration.finish(body.slug);
  }

  @Post('migrate/abort')
  @HttpCode(204)
  @OperatorOnly()
  abort(@Body(new ZodPipe(slugBody)) body: SlugBody) {
    return this.migration.abort(body.slug);
  }

  // A company login copied without its secret: pnpm ops enterprise idp-secret (the secret on stdin).
  @Put(':slug/idps/:alias/secret')
  @HttpCode(204)
  @OperatorOnly()
  setIdpSecret(
    @Param('slug') slug: string,
    @Param('alias') alias: string,
    @Body(new ZodPipe(idpSecretBody)) body: IdpSecretBody,
  ) {
    return this.migration.setIdpSecret(slug, alias, body.secret);
  }

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
