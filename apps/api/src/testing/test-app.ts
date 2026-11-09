import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  claimDomain,
  createDb,
  insertIdp,
  markDomainVerified,
  platformRepository,
  tenantTx,
  type Db,
  type Pool,
  type TenantRecord,
} from '@tenantry/db';
import {
  InMemoryIdentityDirectory,
  InMemoryRealmApps,
  InMemoryRealmMembers,
  InMemoryRealmProvisioner,
  InMemoryRealmBridge,
  InMemoryRealmConsole,
  InMemoryRealmIdps,
  InMemoryRealmScim,
} from '@tenantry/keycloak-admin/testing';
import type { SecretStore } from '@tenantry/keycloak-admin/secrets';
import { organizationMembers, TEMPLATE_VERSION } from '@tenantry/keycloak-admin';
import { AppModule } from '../app.module.js';
import type { AppConfig } from '../config/config.js';
import { setUpHttp } from '../http-setup.js';
import type { MemberDirectories } from '../infrastructure/member-directories.js';
import {
  DB_POOL,
  IDENTITY_DIRECTORY,
  MEMBER_DIRECTORIES,
  REALM_APPS,
  REALM_PROVISIONER,
  REALM_BRIDGE,
  REALM_CONSOLE,
  REALM_IDPS,
  REALM_MEMBERS,
  REALM_SCIM,
  SECRET_STORE,
} from '../infrastructure/tokens.js';
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
    // Sent as it is (multipart uploads); set content-type in headers.
    raw?: Buffer;
    headers?: Record<string, string>;
  }): Promise<TestResponse<T>>;
  seedTenant(): Promise<TestTenant>;
  // An enterprise tenant: realm ent-<slug>, its own issuer at the test issuer, no organization.
  seedEnterpriseTenant(): Promise<TestTenant & { issuer: string; realm: string }>;
  // A token from that tenant's realm, carrying these tenantry-api client roles.
  enterpriseToken(
    tenant: { issuer: string },
    user: TestUser,
    roles: string[],
    extra?: Record<string, unknown>,
  ): Promise<string>;
  // A platform-realm client-credentials token for the operator scripts (tenantry-ops).
  operatorToken(extra?: Record<string, unknown>): Promise<string>;
  // The in-memory member directory of an enterprise realm (its tenantry-api roles).
  realmMembers(realm: string): InMemoryRealmMembers;
  // The in-memory clients of an enterprise realm (customer apps).
  realmApps(realm: string): InMemoryRealmApps;
  // The in-memory native SCIM of an enterprise realm, behind the gateway.
  realmScim(realm: string): InMemoryRealmScim;
  // The in-memory console access of an enterprise realm.
  realmConsole(realm: string): InMemoryRealmConsole;
  // A move to Enterprise: the new realm's bridge and copied company logins.
  realmBridge(realm: string): InMemoryRealmBridge;
  realmIdps(realm: string): InMemoryRealmIdps;
  // A company login linked to a Standard workspace for a verified domain, as pnpm ops idp link does.
  linkCompanyLogin(tenant: TestTenant, alias: string, domain: string): Promise<void>;
  // Moves the tenant's SCIM tokens' expiry into the past.
  expireScimTokens(tenantId: string): Promise<void>;
  // Enterprise provisioning against an in-memory Keycloak and secrets store.
  provisioner: InMemoryRealmProvisioner;
  secrets: SecretStore;
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
export async function createTestApp(
  o: { controllers?: Type[]; config?: Partial<AppConfig> } = {},
): Promise<TestApp> {
  const issuer = await makeTestIssuer();
  const directory = new InMemoryIdentityDirectory();
  const realmMembers = new Map<string, InMemoryRealmMembers>();
  const provisioner = new InMemoryRealmProvisioner();
  const stored = new Map<string, string>();
  const secrets: SecretStore = {
    get: (key) => Promise.resolve(stored.get(key) ?? null),
    put: (key, value) => {
      stored.set(key, value);
      return Promise.resolve();
    },
  };
  const realmOf = (realm: string) => {
    let found = realmMembers.get(realm);
    if (!found) {
      found = new InMemoryRealmMembers();
      realmMembers.set(realm, found);
    }
    return found;
  };
  const realmApps = new Map<string, InMemoryRealmApps>();
  const appsOf = (realm: string) => {
    let found = realmApps.get(realm);
    if (!found) {
      found = new InMemoryRealmApps();
      realmApps.set(realm, found);
    }
    return found;
  };
  const realmScims = new Map<string, InMemoryRealmScim>();
  const scimOf = (realm: string, realmIssuer?: string) => {
    let found = realmScims.get(realm);
    if (!found) {
      found = new InMemoryRealmScim(realmIssuer ?? `${issuer.baseUrl}/realms/${realm}`);
      realmScims.set(realm, found);
    }
    return found;
  };
  const realmConsoles = new Map<string, InMemoryRealmConsole>();
  const consoleOf = (realm: string) => {
    let found = realmConsoles.get(realm);
    if (!found) {
      found = new InMemoryRealmConsole(realm, issuer.baseUrl);
      realmConsoles.set(realm, found);
    }
    return found;
  };
  const bridges = new Map<string, InMemoryRealmBridge>();
  const bridgeOf = (realm: string) => {
    let found = bridges.get(realm);
    if (!found) {
      found = new InMemoryRealmBridge();
      bridges.set(realm, found);
    }
    return found;
  };
  const realmIdpsMap = new Map<string, InMemoryRealmIdps>();
  const idpsOf = (realm: string) => {
    let found = realmIdpsMap.get(realm);
    if (!found) {
      found = new InMemoryRealmIdps();
      realmIdpsMap.set(realm, found);
    }
    return found;
  };
  const memberDirectories: MemberDirectories = {
    forTenant: (tenant) =>
      Promise.resolve(
        tenant.tier === 'enterprise'
          ? realmOf(tenant.realm ?? '')
          : organizationMembers(directory, tenant.kcOrgId ?? ''),
      ),
  };
  const config: AppConfig = {
    port: 0,
    databaseUrl: stackEnv('DATABASE_URL'),
    authUrl: issuer.baseUrl,
    authInternalUrl: issuer.baseUrl,
    platformRealm: 'platform',
    logLevel: 'error',
    version: 'dev',
    baseDomain: 'tenantry.localhost',
    publicPort: null,
    backendClientId: 'unused',
    backendClientSecret: 'unused',
    provisionerClientId: 'unused',
    provisionerClientSecret: 'unused',
    secretsDir: '.secrets-test',
    smtp: { host: 'mailpit', port: '1025', from: 'no-reply@tenantry.localhost' },
    maxAppsPerTenant: 20,
    ...o.config,
  };
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forConfig(config)],
    controllers: o.controllers ?? [],
  })
    .overrideProvider(IDENTITY_DIRECTORY)
    .useValue(directory)
    .overrideProvider(MEMBER_DIRECTORIES)
    .useValue(memberDirectories)
    .overrideProvider(REALM_PROVISIONER)
    .useValue(provisioner)
    .overrideProvider(SECRET_STORE)
    .useValue(secrets)
    .overrideProvider(REALM_APPS)
    .useValue({ forTenant: (tenant: TenantRecord) => Promise.resolve(appsOf(tenant.realm ?? '')) })
    .overrideProvider(REALM_MEMBERS)
    .useValue({ forRealm: (realm: string) => Promise.resolve(realmOf(realm)) })
    .overrideProvider(REALM_BRIDGE)
    .useValue({ forRealm: bridgeOf })
    .overrideProvider(REALM_IDPS)
    .useValue({ forRealm: idpsOf })
    .overrideProvider(REALM_CONSOLE)
    .useValue({ forRealm: consoleOf })
    .overrideProvider(REALM_SCIM)
    .useValue({
      // As the real factory: only an enterprise tenant with a realm and an issuer has native SCIM.
      forTenant: (tenant: TenantRecord) => {
        if (tenant.tier !== 'enterprise' || !tenant.realm || !tenant.issuer) {
          throw new Error(`tenant ${tenant.slug} has no realm of its own`);
        }
        return scimOf(tenant.realm, tenant.issuer);
      },
    })
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  setUpHttp(app);
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as Server;
  const port = (server.address() as AddressInfo).port;
  const pool = app.get<Pool>(DB_POOL);
  const db = createDb(pool);

  const testApp: TestApp = {
    app,
    config,
    db,
    issuer,
    directory,
    apexHost: 'tenantry.localhost',
    request: ({ host, method = 'GET', path, token, body, raw, headers = {} }) =>
      new Promise((resolve, reject) => {
        const payload = raw ?? (body === undefined ? undefined : JSON.stringify(body));
        const req = httpRequest(
          {
            host: '127.0.0.1',
            port,
            method,
            path,
            headers: {
              host,
              ...(token ? { authorization: `Bearer ${token}` } : {}),
              ...(payload && !raw ? { 'content-type': 'application/json' } : {}),
              ...headers,
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
            });
            res.on('end', () => {
              // JSON bodies are parsed; anything else (a logo) stays bytes.
              const bytes = Buffer.concat(chunks);
              const json = /json/.test(res.headers['content-type'] ?? '');
              resolve({
                status: res.statusCode ?? 0,
                body: (bytes.length === 0
                  ? undefined
                  : json
                    ? JSON.parse(bytes.toString('utf8'))
                    : bytes) as never,
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
    async seedEnterpriseTenant() {
      const slug = `e${randomUUID().slice(0, 8)}`;
      const realm = `ent-${slug}`;
      const realmIssuer = `${issuer.baseUrl}/realms/${realm}`;
      const platform = platformRepository(db);
      const { id } = await platform.insertProvisioningTenant({
        slug,
        name: `Enterprise ${slug}`,
        tier: 'enterprise',
      });
      await platform.activateTenant(id, {
        realm,
        issuer: realmIssuer,
        kcOrgId: null,
        templateVersion: TEMPLATE_VERSION,
      });
      return { id, slug, kcOrgId: '', host: `${slug}.tenantry.localhost`, issuer: realmIssuer, realm };
    },
    enterpriseToken: (tenant, user, roles, extra = {}) =>
      issuer.sign({
        iss: tenant.issuer,
        sub: user.sub,
        email: user.email,
        aud: 'tenantry-api',
        azp: 'tenantry-web',
        email_verified: true,
        ...(roles.length ? { resource_access: { 'tenantry-api': { roles } } } : {}),
        ...extra,
      }),
    operatorToken: (extra = {}) =>
      issuer.sign({ sub: randomUUID(), aud: 'tenantry-api', azp: 'tenantry-ops', ...extra }),
    realmMembers: realmOf,
    realmApps: appsOf,
    realmScim: scimOf,
    realmConsole: consoleOf,
    realmBridge: bridgeOf,
    realmIdps: idpsOf,
    async linkCompanyLogin(tenant, alias, domain) {
      await tenantTx(db, tenant.id, async (tx) => {
        const claimed = await claimDomain(tx, domain);
        await markDomainVerified(tx, claimed.id);
        await insertIdp(tx, { alias, domainId: claimed.id });
      });
      await directory.createOidcIdentityProvider({
        alias,
        issuer: 'http://corp.test/realms/corp',
        clientId: 'tenantry-platform',
        clientSecret: 'company-secret',
      });
    },
    async expireScimTokens(tenantId) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
        await client.query("update tenant_scim_tokens set expires_at = now() - interval '1 second'");
        await client.query('commit');
      } finally {
        client.release();
      }
    },
    provisioner,
    secrets,
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
