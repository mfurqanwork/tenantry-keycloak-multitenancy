import type { OriginSettings } from '@tenantry/auth';
import type { Db } from '@tenantry/db';
import type { IdentityDirectory } from '@tenantry/keycloak-admin';
import type { SecretStore } from '@tenantry/keycloak-admin/secrets';

// Everything a command touches. cli.ts wires the real ones; tests pass the in-memory Keycloak and a
// fake resolver, against the compose Postgres.
export interface OpsDeps {
  db: Db;
  directory: IdentityDirectory;
  resolveTxt: (name: string) => Promise<string[]>;
  // Where the API's secrets live too (ADR-0023): company logins' secrets, for a move to Enterprise.
  secrets: SecretStore;
  origins: OriginSettings;
  out: (line: string) => void;
  err: (line: string) => void;
}

// Commands answer like a shell program: 0 when done, 1 when refused (with one line on err).
export type ExitCode = 0 | 1;
