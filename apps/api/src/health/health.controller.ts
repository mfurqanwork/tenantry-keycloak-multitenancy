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
  // Public, so it says only that all is well and which version runs; a failure is a 503 whose
  // details stay inside the API.
  async check(): Promise<{ status: HealthCheckResult['status']; version: string }> {
    const result = await this.health.check([() => this.database.check(), () => this.keycloak.check()]);
    return { status: result.status, version: this.config.version };
  }
}
