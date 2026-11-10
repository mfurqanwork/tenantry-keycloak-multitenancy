import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { HealthCheck, HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { DatabaseHealthIndicator } from './db.health.js';
import { KeycloakHealthIndicator } from './keycloak.health.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly keycloak: KeycloakHealthIndicator,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  async check(): Promise<HealthCheckResult & { version: string }> {
    const result = await this.health.check([() => this.database.check(), () => this.keycloak.check()]);
    return { ...result, version: this.config.version };
  }
}
