import { Inject, Injectable } from '@nestjs/common';
import { tenantOrigin, userSignIn } from '@tenantry/auth';
import {
  countApps,
  createApp,
  getApp,
  listApps,
  lockTenantApps,
  tenantTx,
  type AppRecord,
  type Db,
  type TenantRecord,
  type TenantTx,
} from '@tenantry/db';
import {
  AppClientMissingError,
  DirectoryError,
  newAppClientId,
  type AppClientSpec,
} from '@tenantry/keycloak-admin';
import { ConflictProblem, NotFoundProblem, ValidationProblem } from '../../common/http-errors.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import type { RealmAppsFactory } from '../../infrastructure/realm-apps.js';
import { DB, REALM_APPS } from '../../infrastructure/tokens.js';
import { AuditService, type AuditAction } from '../audit/audit.service.js';
import type { AppBody } from './apps.schemas.js';

export interface AppConnection {
  issuer: string;
  discoveryUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  endSessionEndpoint: string;
  clientId: string;
  scopes: 'openid profile email';
  // The portal's test sign-in, also registered on the client; null for machine to machine.
  testRedirectUri: string | null;
}

export type AppView = Omit<AppRecord, 'kcClientUuid' | 'createdBy'> & { connection: AppConnection };

// A person (userId) or the operator scripts (userId null, via 'ops').
export interface AppActor {
  userId: string | null;
  via?: 'ops';
}

interface Created {
  kcClientUuid: string;
  secret: string | null;
}

// Customer apps of enterprise workspaces (ADR-0011). Our table is the record; the Keycloak client is
// written in the same request, and taken back if the row cannot be written.
@Injectable()
export class AppsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REALM_APPS) private readonly realms: RealmAppsFactory,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  async list(tenant: TenantRecord): Promise<{ apps: AppView[] }> {
    this.enterpriseOnly(tenant);
    const apps = await tenantTx(this.db, tenant.id, (tx) => listApps(tx));
    return { apps: apps.map((app) => this.view(tenant, app)) };
  }

  async get(tenant: TenantRecord, id: string): Promise<AppView> {
    return this.view(tenant, await this.find(tenant, id));
  }

  async register(
    tenant: TenantRecord,
    body: AppBody,
    actor: AppActor,
  ): Promise<{ app: AppView; clientSecret?: string }> {
    this.enterpriseOnly(tenant);
    const apps = await this.realms.forTenant(tenant);
    const clientId = newAppClientId();
    const made: { client: Created | null } = { client: null };
    try {
      const record = await tenantTx(this.db, tenant.id, async (tx) => {
        await lockTenantApps(tx);
        if ((await countApps(tx)) >= this.config.maxAppsPerTenant) {
          throw new ConflictProblem(
            `This workspace has the most apps allowed (${String(this.config.maxAppsPerTenant)}).`,
          );
        }
        made.client = await apps.create(clientId, this.keycloakSpec(tenant, body));
        const row = await createApp(tx, {
          clientId,
          kcClientUuid: made.client.kcClientUuid,
          name: body.name,
          type: body.type,
          redirectUris: body.redirectUris,
          postLogoutRedirectUris: body.postLogoutRedirectUris,
          webOrigins: body.webOrigins,
          createdBy: actor.userId,
        });
        await this.record(tx, actor, 'app.registered', row);
        return row;
      });
      const secret = made.client?.secret;
      return { app: this.view(tenant, record), ...(secret ? { clientSecret: secret } : {}) };
    } catch (err) {
      // The client exists in Keycloak but the row does not: take the client back.
      if (made.client) await apps.remove(made.client.kcClientUuid).catch(() => undefined);
      throw this.problem(err);
    }
  }

  protected enterpriseOnly(tenant: TenantRecord): void {
    if (tenant.tier !== 'enterprise') {
      throw new NotFoundProblem('Applications are available on Enterprise workspaces.');
    }
  }

  protected async find(tenant: TenantRecord, id: string): Promise<AppRecord> {
    this.enterpriseOnly(tenant);
    const app = await tenantTx(this.db, tenant.id, (tx) => getApp(tx, id));
    if (!app) throw new NotFoundProblem('No app with this id.');
    return app;
  }

  // Never the secret: name and client id, and who acted when it was not a person.
  protected record(
    tx: TenantTx,
    actor: AppActor,
    action: AuditAction,
    app: Pick<AppRecord, 'id' | 'name' | 'clientId'>,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    return this.audit.record(tx, { userId: actor.userId }, action, app.id, {
      name: app.name,
      clientId: app.clientId,
      ...extra,
      ...(actor.via ? { via: actor.via } : {}),
    });
  }

  protected testRedirectUri(tenant: TenantRecord): string {
    return `${tenantOrigin(tenant.slug, this.config, 'portal')}/applications/test-callback`;
  }

  // What Keycloak gets: the customer's URIs plus, for apps people sign in to, our test sign-in.
  protected keycloakSpec(tenant: TenantRecord, app: AppClientSpec): AppClientSpec {
    const { name, type, redirectUris, postLogoutRedirectUris, webOrigins } = app;
    return {
      name,
      type,
      redirectUris: userSignIn(type) ? [...redirectUris, this.testRedirectUri(tenant)] : redirectUris,
      postLogoutRedirectUris,
      webOrigins,
    };
  }

  // Keycloak's refusals in terms the person can act on.
  protected problem(err: unknown): unknown {
    if (err instanceof DirectoryError && err.status === 400) {
      return new ValidationProblem(err.detail ?? 'Keycloak refused this app.');
    }
    if (err instanceof AppClientMissingError) {
      return new ConflictProblem("This app's client no longer exists in Keycloak. Delete the app.");
    }
    return err;
  }

  protected view(tenant: TenantRecord, app: AppRecord): AppView {
    const issuer = tenant.issuer ?? '';
    const oidc = `${issuer}/protocol/openid-connect`;
    const {
      id,
      clientId,
      name,
      type,
      redirectUris,
      postLogoutRedirectUris,
      webOrigins,
      createdAt,
      updatedAt,
    } = app;
    return {
      id,
      clientId,
      name,
      type,
      redirectUris,
      postLogoutRedirectUris,
      webOrigins,
      createdAt,
      updatedAt,
      connection: {
        issuer,
        discoveryUrl: `${issuer}/.well-known/openid-configuration`,
        authorizationEndpoint: `${oidc}/auth`,
        tokenEndpoint: `${oidc}/token`,
        jwksUri: `${oidc}/certs`,
        endSessionEndpoint: `${oidc}/logout`,
        clientId: app.clientId,
        scopes: 'openid profile email',
        testRedirectUri: userSignIn(app.type) ? this.testRedirectUri(tenant) : null,
      },
    };
  }
}
