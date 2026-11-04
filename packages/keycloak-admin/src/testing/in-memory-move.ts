import { DirectoryError } from '../errors.js';
import type { IdentityProviderSettings } from '../identity-directory.js';
import type { RealmBridge } from '../realms/bridge.js';
import type { RealmIdps } from '../realms/idp-copy.js';

class Failing {
  private failure: number | null = null;

  // The next call fails as Keycloak would, with this status.
  failNext(status: number): void {
    this.failure = status;
  }

  protected run<T>(operation: string, fn: () => T): Promise<T> {
    const failure = this.failure;
    this.failure = null;
    if (failure !== null) return Promise.reject(new DirectoryError(operation, failure, 'injected failure'));
    return Promise.resolve(fn());
  }
}

// A realm's copied company logins and links, for the API's tests of a move to Enterprise.
export class InMemoryRealmIdps extends Failing implements RealmIdps {
  readonly providers = new Map<
    string,
    { settings: IdentityProviderSettings; enabled: boolean; secret: string | null }
  >();
  // kcUserId → alias → remote user id
  readonly links = new Map<string, Map<string, string>>();

  copy(provider: IdentityProviderSettings, secret: string | null): Promise<{ enabled: boolean }> {
    return this.run('copyIdp', () => {
      const current = this.providers.get(provider.alias);
      const kept = secret ?? current?.secret ?? null;
      this.providers.set(provider.alias, { settings: provider, enabled: kept !== null, secret: kept });
      return { enabled: kept !== null };
    });
  }

  setSecret(alias: string, secret: string): Promise<void> {
    return this.run('setIdpSecret', () => {
      const current = this.providers.get(alias);
      if (!current) throw new DirectoryError('setIdpSecret', 404, alias);
      this.providers.set(alias, { ...current, enabled: true, secret });
    });
  }

  link(kcUserId: string, alias: string, remote: { userId: string; userName: string }): Promise<void> {
    return this.run('linkIdentity', () => {
      const held = this.links.get(kcUserId) ?? new Map<string, string>();
      held.set(alias, remote.userId);
      this.links.set(kcUserId, held);
    });
  }
}

// A realm's bridge for the API's tests.
export class InMemoryRealmBridge extends Failing implements RealmBridge {
  present = false;
  secret: string | null = null;

  ensure(input: { slug: string; secret: string }): Promise<void> {
    return this.run('ensureBridge', () => {
      this.present = true;
      this.secret = input.secret;
    });
  }

  remove(): Promise<void> {
    return this.run('removeBridge', () => {
      this.present = false;
    });
  }
}
