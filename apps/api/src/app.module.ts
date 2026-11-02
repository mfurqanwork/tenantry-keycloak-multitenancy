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
import { AuditModule } from './modules/audit/audit.module.js';
import { MembersModule } from './modules/members/members.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { SignupModule } from './modules/signup/signup.module.js';
import { TenantsModule } from './modules/tenants/tenants.module.js';

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
        TenantsModule,
        AuditModule,
        ProjectsModule,
        SignupModule,
        MembersModule,
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
