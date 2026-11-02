import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { ProblemFilter } from './common/problem.filter.js';
import type { AppConfig } from './config/config.js';
import { DatabaseHealthIndicator } from './health/db.health.js';
import { HealthController } from './health/health.controller.js';
import { KeycloakHealthIndicator } from './health/keycloak.health.js';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';

@Module({})
export class AppModule {
  static forConfig(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        InfrastructureModule.forConfig(config),
        LoggerModule.forRoot({ pinoHttp: { level: config.logLevel } }),
        TerminusModule,
        AuthModule,
      ],
      controllers: [HealthController],
      providers: [
        { provide: APP_FILTER, useClass: ProblemFilter },
        DatabaseHealthIndicator,
        KeycloakHealthIndicator,
      ],
    };
  }
}
