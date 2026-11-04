import { type DynamicModule, Global, Module, type OnApplicationShutdown, Inject } from '@nestjs/common';
import { createAppPool, createDb, type Pool } from '@tenantry/db';
import {
  createHttpIdentityDirectory,
  createHttpRealmProvisioner,
  createRealmApps,
  createRealmScim,
  createRealmMembers,
  type IdentityDirectory,
} from '@tenantry/keycloak-admin';
import { createFileSecretStore, type SecretStore } from '@tenantry/keycloak-admin/secrets';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { createMemberDirectories } from './member-directories.js';
import { createRealmAppsFactory } from './realm-apps.js';
import { createRealmScimFactory } from './realm-scim.js';
import {
  DB,
  DB_POOL,
  IDENTITY_DIRECTORY,
  MEMBER_DIRECTORIES,
  REALM_APPS,
  REALM_SCIM,
  REALM_PROVISIONER,
  SECRET_STORE,
} from './tokens.js';

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
        { provide: SECRET_STORE, useFactory: () => createFileSecretStore(config.secretsDir) },
        {
          provide: MEMBER_DIRECTORIES,
          useFactory: (directory: IdentityDirectory, secrets: SecretStore) =>
            createMemberDirectories({
              directory,
              secrets,
              realmMembers: (realm, clientSecret) =>
                createRealmMembers({ baseUrl: config.authInternalUrl, realm, clientSecret }),
            }),
          inject: [IDENTITY_DIRECTORY, SECRET_STORE],
        },
        {
          provide: REALM_APPS,
          useFactory: (secrets: SecretStore) =>
            createRealmAppsFactory({
              secrets,
              realmApps: (realm, clientSecret) =>
                createRealmApps({ baseUrl: config.authInternalUrl, realm, clientSecret }),
            }),
          inject: [SECRET_STORE],
        },
        {
          provide: REALM_SCIM,
          useFactory: (secrets: SecretStore) =>
            createRealmScimFactory((realm, publicIssuer) =>
              createRealmScim({
                baseUrl: config.authInternalUrl,
                publicIssuer,
                realm,
                provisionerClientId: config.provisionerClientId,
                provisionerClientSecret: config.provisionerClientSecret,
                secrets,
              }),
            ),
          inject: [SECRET_STORE],
        },
        {
          provide: REALM_PROVISIONER,
          useFactory: () =>
            createHttpRealmProvisioner({
              baseUrl: config.authInternalUrl,
              clientId: config.provisionerClientId,
              clientSecret: config.provisionerClientSecret,
            }),
        },
      ],
      exports: [
        APP_CONFIG,
        DB_POOL,
        DB,
        IDENTITY_DIRECTORY,
        SECRET_STORE,
        MEMBER_DIRECTORIES,
        REALM_PROVISIONER,
        REALM_APPS,
        REALM_SCIM,
      ],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
