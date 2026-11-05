import { DirectoryError } from '../errors.js';
import type { RealmConsole } from '../realms/console.js';

// A realm's console access for the API's tests; the console contract keeps it honest against Keycloak.
export class InMemoryRealmConsole implements RealmConsole {
  readonly members = new Set<string>();
  owners: string[] = [];
  permissionsEnsured = 0;
  private failure: number | null = null;

  constructor(
    readonly realm = 'ent-fake',
    readonly publicAuthUrl = 'http://auth.test',
  ) {}

  // The next call fails as Keycloak would, with this status.
  failNext(status: number): void {
    this.failure = status;
  }

  private run<T>(operation: string, fn: () => T): Promise<T> {
    const failure = this.failure;
    this.failure = null;
    if (failure !== null) return Promise.reject(new DirectoryError(operation, failure, 'injected failure'));
    return Promise.resolve(fn());
  }

  ensurePermissions(): Promise<void> {
    return this.run('ensurePermissions', () => {
      this.permissionsEnsured++;
    });
  }

  grant(kcUserId: string): Promise<void> {
    return this.run('grantConsole', () => {
      this.members.add(kcUserId);
    });
  }

  revoke(kcUserId: string): Promise<void> {
    return this.run('revokeConsole', () => {
      this.members.delete(kcUserId);
    });
  }

  protectOwners(ownerIds: string[]): Promise<void> {
    return this.run('protectOwners', () => {
      this.owners = [...new Set(ownerIds)];
    });
  }

  consoleUrl(): string {
    return `${this.publicAuthUrl}/admin/${this.realm}/console/`;
  }
}
