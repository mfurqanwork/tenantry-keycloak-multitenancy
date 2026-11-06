import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { loggerOptions } from './common/logging.js';
import { ProblemFilter } from './common/problem.filter.js';
import type { AppConfig } from './config/config.js';
import { DatabaseHealthIndicator } from './health/db.health.js';
import { HealthController } from './health/health.controller.js';
import { KeycloakHealthIndicator } from './health/keycloak.health.js';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { BrandingModule } from './modules/branding/branding.module.js';
import { EnterpriseModule } from './modules/enterprise/enterprise.module.js';
import { MembersModule } from './modules/members/members.module.js';
import { AppsModule } from './modules/apps/apps.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { ConsoleModule } from './modules/console/console.module.js';
import { ScimModule } from './modules/scim/scim.module.js';
import { SecurityModule } from './modules/security/security.module.js';
import { SignupModule } from './modules/signup/signup.module.js';
import { TenantsModule } from './modules/tenants/tenants.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';

@Module({})
export class AppModule {
  static forConfig(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        InfrastructureModule.forConfig(config),
        LoggerModule.forRoot({ pinoHttp: loggerOptions(config.logLevel) }),
        TerminusModule,
        AuthModule,
        TenantsModule,
        AuditModule,
        NotificationsModule,
        ProjectsModule,
        SignupModule,
        MembersModule,
        AppsModule,
        WorkspacesModule,
        BrandingModule,
        EnterpriseModule,
        SecurityModule,
        ScimModule,
        ConsoleModule,
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
