import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createAppPool, createDb } from '@tenantry/db';
import { createHttpIdentityDirectory } from '@tenantry/keycloak-admin';
import { setTxt } from './commands/dns.js';
import { claimDomain, verifyDomain } from './commands/domain.js';
import { linkIdp } from './commands/idp.js';
import { syncOrigins } from './commands/tenants.js';
import type { OpsDeps } from './deps.js';
import { resolveTxt } from './dns/txt.js';
import { stackEnv } from './env.js';

const USAGE = `Usage: pnpm ops <command>

  domain claim  --tenant <slug> --domain <domain>
  domain verify --tenant <slug> --domain <domain>
  idp link      --tenant <slug> --domain <domain> --alias <alias> --issuer <url> --client-id <id> --client-secret <secret>
  tenants sync-origins
  dns set-txt <name> <value>     (dev only: writes the local DNS zone)`;

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ZONE_FILE = fileURLToPath(new URL('../../../infra/dns/zones/test.db', import.meta.url));

// SIGUSR1 makes CoreDNS reload its configuration and zones, in place.
function reloadDns(): void {
  execFileSync(
    'docker',
    ['compose', '-f', 'infra/docker-compose.yml', '--env-file', '.env', 'kill', '-s', 'SIGUSR1', 'dns'],
    { cwd: ROOT, stdio: 'ignore' },
  );
}

// The real dependencies: Postgres as the app role, Keycloak as the operator service account (ADR-0022).
function realDeps(): { deps: OpsDeps; close: () => Promise<void> } {
  const pool = createAppPool(stackEnv('DATABASE_URL'));
  const authUrl = stackEnv('TENANTRY_AUTH_URL');
  const port = new URL(authUrl).port;
  const dnsServer = process.env['TENANTRY_DNS_SERVER'] ?? stackEnv('TENANTRY_DNS_SERVER', '');
  return {
    deps: {
      db: createDb(pool),
      directory: createHttpIdentityDirectory({
        baseUrl: stackEnv('TENANTRY_AUTH_INTERNAL_URL', authUrl),
        realm: stackEnv('TENANTRY_PLATFORM_REALM', 'platform'),
        clientId: stackEnv('KEYCLOAK_OPS_CLIENT_ID'),
        clientSecret: stackEnv('KEYCLOAK_OPS_CLIENT_SECRET'),
        webClientId: 'tenantry-web',
        portalClientId: 'tenantry-portal',
      }),
      resolveTxt: (name) => resolveTxt(name, dnsServer || undefined),
      origins: {
        authUrl,
        baseDomain: stackEnv('TENANTRY_BASE_DOMAIN', 'tenantry.localhost'),
        publicPort: port ? Number(port) : null,
      },
      out: (line) => {
        console.log(line);
      },
      err: (line) => {
        console.error(line);
      },
    },
    close: () => pool.end(),
  };
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      tenant: { type: 'string' },
      domain: { type: 'string' },
      alias: { type: 'string' },
      issuer: { type: 'string' },
      'client-id': { type: 'string' },
      'client-secret': { type: 'string' },
    },
  });
  const [group, command, ...rest] = positionals;
  const need = (name: keyof typeof values): string => {
    const value = values[name];
    if (!value) throw new Error(`--${name} is required.\n\n${USAGE}`);
    return value;
  };

  if (group === 'dns' && command === 'set-txt' && rest.length === 2) {
    return setTxt(
      ZONE_FILE,
      rest[0] ?? '',
      rest[1] ?? '',
      (line) => {
        console.log(line);
      },
      reloadDns,
    );
  }
  const run = async (fn: (deps: OpsDeps) => Promise<number>) => {
    const { deps, close } = realDeps();
    try {
      return await fn(deps);
    } finally {
      await close();
    }
  };
  switch (`${group ?? ''} ${command ?? ''}`) {
    case 'domain claim':
      return run((deps) => claimDomain(deps, { tenant: need('tenant'), domain: need('domain') }));
    case 'domain verify':
      return run((deps) => verifyDomain(deps, { tenant: need('tenant'), domain: need('domain') }));
    case 'idp link':
      return run((deps) =>
        linkIdp(deps, {
          tenant: need('tenant'),
          domain: need('domain'),
          alias: need('alias'),
          issuer: need('issuer'),
          clientId: need('client-id'),
          clientSecret: need('client-secret'),
        }),
      );
    case 'tenants sync-origins':
      return run(syncOrigins);
    default:
      console.error(USAGE);
      return 1;
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  },
);
