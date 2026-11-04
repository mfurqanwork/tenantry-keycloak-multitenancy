import { randomBytes, randomUUID } from 'node:crypto';
import { DirectoryError } from '../errors.js';
import { CUSTOMER_APP_ATTRIBUTE, type AppClientSpec } from '../realms/app-clients.js';
import { AppClientMissingError, type RealmApps } from '../realms/realm-apps.js';

interface FakeClient {
  clientId: string;
  spec: AppClientSpec;
  secret: string | null;
  attributes: Record<string, string>;
}

const newSecret = () => randomBytes(24).toString('base64url');

// An enterprise realm's clients for unit tests. The apps contract keeps it honest against Keycloak.
export class InMemoryRealmApps implements RealmApps {
  readonly clients = new Map<string, FakeClient>();
  // Stands for tenantry-web: present, but not a customer app.
  readonly productClientUuid = randomUUID();
  private failure: { status: number; detail: string } | null = null;

  constructor() {
    this.clients.set(this.productClientUuid, {
      clientId: 'tenantry-web',
      spec: { name: 'Tenantry', type: 'spa', redirectUris: [], postLogoutRedirectUris: [], webOrigins: [] },
      secret: null,
      attributes: {},
    });
  }

  // The next call fails as Keycloak would, with this status and reason.
  failNext(status: number, detail: string): void {
    this.failure = { status, detail };
  }

  private run<T>(operation: string, fn: () => T): Promise<T> {
    return Promise.resolve().then(() => {
      const failure = this.failure;
      this.failure = null;
      if (failure) throw new DirectoryError(operation, failure.status, failure.detail);
      return fn();
    });
  }

  private customerApp(operation: string, kcClientUuid: string): FakeClient | null {
    const client = this.clients.get(kcClientUuid);
    if (!client) return null;
    if (client.attributes[CUSTOMER_APP_ATTRIBUTE] !== 'true') {
      throw new DirectoryError(operation, 403, 'not a customer app');
    }
    return client;
  }

  create(clientId: string, spec: AppClientSpec): Promise<{ kcClientUuid: string; secret: string | null }> {
    return this.run('createApp', () => {
      const kcClientUuid = randomUUID();
      const secret = spec.type === 'web' || spec.type === 'm2m' ? newSecret() : null;
      this.clients.set(kcClientUuid, {
        clientId,
        spec,
        secret,
        attributes: { [CUSTOMER_APP_ATTRIBUTE]: 'true' },
      });
      return { kcClientUuid, secret };
    });
  }

  update(kcClientUuid: string, spec: AppClientSpec): Promise<void> {
    return this.run('updateApp', () => {
      const client = this.customerApp('updateApp', kcClientUuid);
      if (!client) throw new AppClientMissingError(kcClientUuid);
      client.spec = spec;
    });
  }

  rotateSecret(kcClientUuid: string): Promise<string> {
    return this.run('rotateSecret', () => {
      const client = this.customerApp('rotateSecret', kcClientUuid);
      if (!client) throw new AppClientMissingError(kcClientUuid);
      client.secret = newSecret();
      return client.secret;
    });
  }

  remove(kcClientUuid: string): Promise<void> {
    return this.run('removeApp', () => {
      if (this.customerApp('removeApp', kcClientUuid)) this.clients.delete(kcClientUuid);
    });
  }

  checkClientCredentials(
    clientId: string,
    secret: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    return this.run('checkClientCredentials', () => {
      const client = [...this.clients.values()].find((c) => c.clientId === clientId);
      if (client?.spec.type === 'm2m' && client.secret === secret) return { ok: true as const };
      return { ok: false as const, error: 'Invalid client or Invalid client credentials' };
    });
  }

  // Tests: the client was deleted in Keycloak by hand.
  forget(kcClientUuid: string): void {
    this.clients.delete(kcClientUuid);
  }
}
