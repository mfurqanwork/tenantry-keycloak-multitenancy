import { type DynamicModule, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { createAppPool } from '@tenantry/db';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from './config/config.js';
import { DatabaseHealthIndicator, DB_POOL } from './health/db.health.js';
import { HealthController } from './health/health.controller.js';
import { KeycloakHealthIndicator } from './health/keycloak.health.js';

@Module({})
export class AppModule {
  static forConfig(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [TerminusModule, LoggerModule.forRoot({ pinoHttp: { level: config.logLevel } })],
      controllers: [HealthController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: DB_POOL, useFactory: () => createAppPool(config.databaseUrl) },
        DatabaseHealthIndicator,
        KeycloakHealthIndicator,
      ],
    };
  }
}
