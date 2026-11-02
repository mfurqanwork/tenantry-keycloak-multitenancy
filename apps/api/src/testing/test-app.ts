import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createDb, platformRepository, type Db, type Pool } from '@tenantry/db';
import { InMemoryIdentityDirectory } from '@tenantry/keycloak-admin/testing';
import { AppModule } from '../app.module.js';
import type { AppConfig } from '../config/config.js';
import { DB_POOL, IDENTITY_DIRECTORY } from '../infrastructure/tokens.js';
import { stackEnv } from './env.js';
import { makeTestIssuer, type TestIssuer } from './tokens.js';

export interface TestResponse<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string | string[] | undefined>;
}

export interface TestTenant {
  id: string;
  slug: string;
  kcOrgId: string;
  host: string;
}

export interface TestUser {
  sub: string;
  email: string;
}

export interface TestApp {
  app: INestApplication;
  config: AppConfig;
  db: Db;
  issuer: TestIssuer;
  directory: InMemoryIdentityDirectory;
  apexHost: string;
  request<T = unknown>(o: {
    host: string;
    method?: string;
    path: string;
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<TestResponse<T>>;
  seedTenant(): Promise<TestTenant>;
  newUser(): TestUser;
  // Puts the user in the tenant's organization (and group) in the fake directory.
  join(tenant: TestTenant, user: TestUser, group: 'owners' | 'admins' | 'members' | null): Promise<void>;
  // A token shaped like Keycloak's: organization.<alias>.groups, audience tenantry-api.
  token(
    user: TestUser,
    org?: { alias: string; groups: string[] },
    extra?: Record<string, unknown>,
  ): Promise<string>;
  // A new user who is in the tenant with this group, and a token that says so.
  member(
    tenant: TestTenant,
    group: 'owners' | 'admins' | 'members',
  ): Promise<{ user: TestUser; token: string }>;
  close(): Promise<void>;
}

// The real AppModule over the compose Postgres, with a local token issuer and an in-memory Keycloak.
export async function createTestApp(o: { controllers?: Type[] } = {}): Promise<TestApp> {
  const issuer = await makeTestIssuer();
  const directory = new InMemoryIdentityDirectory();
  const config: AppConfig = {
    port: 0,
    databaseUrl: stackEnv('DATABASE_URL'),
    authUrl: issuer.baseUrl,
    authInternalUrl: issuer.baseUrl,
    platformRealm: 'platform',
    logLevel: 'error',
    baseDomain: 'tenantry.localhost',
    publicPort: null,
    backendClientId: 'unused',
    backendClientSecret: 'unused',
  };
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forConfig(config)],
    controllers: o.controllers ?? [],
  })
    .overrideProvider(IDENTITY_DIRECTORY)
    .useValue(directory)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as Server;
  const port = (server.address() as AddressInfo).port;
  const db = createDb(app.get<Pool>(DB_POOL));

  const testApp: TestApp = {
    app,
    config,
    db,
    issuer,
    directory,
    apexHost: 'tenantry.localhost',
    request: ({ host, method = 'GET', path, token, body, headers = {} }) =>
      new Promise((resolve, reject) => {
        const payload = body === undefined ? undefined : JSON.stringify(body);
        const req = httpRequest(
          {
            host: '127.0.0.1',
            port,
            method,
            path,
            headers: {
              host,
              ...(token ? { authorization: `Bearer ${token}` } : {}),
              ...(payload ? { 'content-type': 'application/json' } : {}),
              ...headers,
            },
          },
          (res) => {
            let raw = '';
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => {
              raw += chunk;
            });
            res.on('end', () => {
              resolve({
                status: res.statusCode ?? 0,
                body: (raw ? JSON.parse(raw) : undefined) as never,
                headers: res.headers,
              });
            });
          },
        );
        req.on('error', reject);
        req.end(payload);
      }),
    async seedTenant() {
      const slug = `t${randomUUID().slice(0, 8)}`;
      const platform = platformRepository(db);
      const { id } = await platform.insertProvisioningTenant({ slug, name: `Tenant ${slug}` });
      const org = await directory.createOrganization({ alias: slug, name: slug });
      await directory.createGroups(org.id);
      await platform.activateTenant(id, { realm: 'platform', issuer: issuer.issuer, kcOrgId: org.id });
      return { id, slug, kcOrgId: org.id, host: `${slug}.tenantry.localhost` };
    },
    newUser() {
      const sub = randomUUID();
      const user = { sub, email: `${sub.slice(0, 8)}@example.com` };
      directory.users.set(sub, { email: user.email, displayName: null });
      return user;
    },
    async join(tenant, user, group) {
      await directory.addMember(tenant.kcOrgId, user.sub);
      if (group) await directory.setMemberGroup(tenant.kcOrgId, user.sub, group);
    },
    token: (user, org, extra = {}) =>
      issuer.sign({
        sub: user.sub,
        email: user.email,
        aud: 'tenantry-api',
        email_verified: true,
        ...(org ? { organization: { [org.alias]: { groups: org.groups } } } : {}),
        ...extra,
      }),
    async member(tenant, group) {
      const user = testApp.newUser();
      await testApp.join(tenant, user, group);
      return { user, token: await testApp.token(user, { alias: tenant.slug, groups: [`/${group}`] }) };
    },
    async close() {
      await app.close();
      await issuer.close();
    },
  };
  return testApp;
}
