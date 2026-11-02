import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { HealthCheck, HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './db.health.js';
import { KeycloakHealthIndicator } from './keycloak.health.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly keycloak: KeycloakHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.database.check(), () => this.keycloak.check()]);
  }
}
