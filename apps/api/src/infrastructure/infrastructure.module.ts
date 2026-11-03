import { type DynamicModule, Global, Module, type OnApplicationShutdown, Inject } from '@nestjs/common';
import { createAppPool, createDb, type Pool } from '@tenantry/db';
import { createHttpIdentityDirectory } from '@tenantry/keycloak-admin';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { DB, DB_POOL, IDENTITY_DIRECTORY } from './tokens.js';

// The one place the API binds Postgres and Keycloak. Global, so feature modules just inject the tokens.
@Global()
@Module({})
export class InfrastructureModule implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  static forConfig(config: AppConfig): DynamicModule {
    return {
      module: InfrastructureModule,
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: DB_POOL, useFactory: () => createAppPool(config.databaseUrl) },
        { provide: DB, useFactory: (pool: Pool) => createDb(pool), inject: [DB_POOL] },
        {
          provide: IDENTITY_DIRECTORY,
          useFactory: () =>
            createHttpIdentityDirectory({
              baseUrl: config.authInternalUrl,
              realm: config.platformRealm,
              clientId: config.backendClientId,
              clientSecret: config.backendClientSecret,
              webClientId: 'tenantry-web',
              portalClientId: 'tenantry-portal',
            }),
        },
      ],
      exports: [APP_CONFIG, DB_POOL, DB, IDENTITY_DIRECTORY],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
