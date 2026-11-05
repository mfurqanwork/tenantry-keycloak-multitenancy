import { randomUUID } from 'node:crypto';
import { createAppPool, createDb, platformRepository, type Db } from '@tenantry/db';
import { InMemoryIdentityDirectory } from '@tenantry/keycloak-admin/testing';
import type { OpsDeps } from '../deps.js';
import { stackEnv } from '../env.js';

export { stackEnv } from '../env.js';

export interface TestOps {
  deps: OpsDeps;
  db: Db;
  directory: InMemoryIdentityDirectory;
  // The secrets store, in memory.
  secrets: Map<string, string>;
  // TXT records the fake resolver answers with, by name.
  dns: Map<string, string[]>;
  out: string[];
  err: string[];
  seedTenant(): Promise<{ id: string; slug: string; kcOrgId: string }>;
  close(): Promise<void>;
}

export function createTestOps(): TestOps {
  const pool = createAppPool(stackEnv('DATABASE_URL'));
  const db = createDb(pool);
  const directory = new InMemoryIdentityDirectory();
  const dns = new Map<string, string[]>();
  const secrets = new Map<string, string>();
  const out: string[] = [];
  const err: string[] = [];
  return {
    db,
    directory,
    secrets,
    dns,
    out,
    err,
    deps: {
      db,
      directory,
      resolveTxt: (name) => Promise.resolve(dns.get(name) ?? []),
      secrets: {
        get: (key) => Promise.resolve(secrets.get(key) ?? null),
        put: (key, value) => {
          secrets.set(key, value);
          return Promise.resolve();
        },
      },
      origins: {
        authUrl: 'http://auth.tenantry.localhost',
        baseDomain: 'tenantry.localhost',
        publicPort: null,
      },
      out: (line) => out.push(line),
      err: (line) => err.push(line),
    },
    async seedTenant() {
      const slug = `o${randomUUID().slice(0, 8)}`;
      const platform = platformRepository(db);
      const { id } = await platform.insertProvisioningTenant({ slug, name: `Tenant ${slug}` });
      const org = await directory.createOrganization({ alias: slug, name: slug });
      await platform.activateTenant(id, { realm: 'platform', issuer: 'http://issuer', kcOrgId: org.id });
      return { id, slug, kcOrgId: org.id };
    },
    close: () => pool.end(),
  };
}
