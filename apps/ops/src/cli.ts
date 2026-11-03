import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createAppPool, createDb } from '@tenantry/db';
import { createHttpIdentityDirectory } from '@tenantry/keycloak-admin';
import { createDevUsers } from '@tenantry/keycloak-admin/dev';
import { setTxt } from './commands/dns.js';
import { claimDomain, verifyDomain } from './commands/domain.js';
import { provisionEnterprise, upgradeEnterprise, type EnterpriseDeps } from './commands/enterprise.js';
import { linkIdp } from './commands/idp.js';
import { syncOrigins } from './commands/tenants.js';
import type { OpsDeps } from './deps.js';
import { resolveTxt } from './dns/txt.js';
import { stackEnv } from './env.js';
import { secretFrom } from './secret.js';
import { apiClient } from './seed/http.js';
import { seed } from './seed/seed.js';

const USAGE = `Usage: pnpm ops <command>

  domain claim  --tenant <slug> --domain <domain>
  domain verify --tenant <slug> --domain <domain>
  idp link      --tenant <slug> --domain <domain> --alias <alias> --issuer <url> --client-id <id>
                [--client-secret-env <NAME>]   (the secret is read from that variable or .env; default IDP_CLIENT_SECRET)
  tenants sync-origins
  dns set-txt <name> <value>     (dev only: writes the local DNS zone)
  enterprise provision --slug <slug> --name <name> --admin-email <email>
  enterprise upgrade [--tenant <slug>] [--dry-run]
  seed                           (dev only: the demo workspaces and accounts; also pnpm seed)`;

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

// The demo needs dev-only access: Keycloak's bootstrap admin for accounts and the password-grant test
// client for tokens. Neither exists in a production realm.
// The operator client's token: what the API's @OperatorOnly routes accept (ADR-0010).
async function operatorToken(): Promise<string> {
  const internal = stackEnv('TENANTRY_AUTH_INTERNAL_URL', stackEnv('TENANTRY_AUTH_URL'));
  const realm = stackEnv('TENANTRY_PLATFORM_REALM', 'platform');
  const res = await fetch(`${internal}/realms/${realm}/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: stackEnv('KEYCLOAK_OPS_CLIENT_ID'),
      client_secret: stackEnv('KEYCLOAK_OPS_CLIENT_SECRET'),
    }),
  });
  if (!res.ok) throw new Error(`operator token: ${String(res.status)}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

function enterpriseDeps(): EnterpriseDeps {
  return {
    api: apiClient(Number(stackEnv('TENANTRY_HTTP_PORT', '80'))),
    operatorToken,
    baseDomain: stackEnv('TENANTRY_BASE_DOMAIN', 'tenantry.localhost'),
    out: (line) => {
      console.log(line);
    },
    err: (line) => {
      console.error(line);
    },
  };
}

async function seedWith(deps: OpsDeps): Promise<number> {
  const internal = stackEnv('TENANTRY_AUTH_INTERNAL_URL', stackEnv('TENANTRY_AUTH_URL'));
  const zoneOut = () => undefined;
  return seed({
    ...deps,
    users: createDevUsers({
      baseUrl: internal,
      adminUsername: stackEnv('KC_BOOTSTRAP_ADMIN_USERNAME'),
      adminPassword: stackEnv('KC_BOOTSTRAP_ADMIN_PASSWORD'),
    }),
    api: apiClient(Number(stackEnv('TENANTRY_HTTP_PORT', '80'))),
    operatorToken,
    async tokenFor(email, slug) {
      const res = await fetch(`${internal}/realms/platform/protocol/openid-connect/token`, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: 'tenantry-isolation-tests',
          client_secret: stackEnv('TENANTRY_ISOLATION_CLIENT_SECRET'),
          username: email,
          password: stackEnv('SEED_PASSWORD'),
          scope: slug ? `openid organization:${slug}` : 'openid',
        }),
      });
      if (!res.ok) throw new Error(`token for ${email}: ${String(res.status)}`);
      return ((await res.json()) as { access_token: string }).access_token;
    },
    password: stackEnv('SEED_PASSWORD'),
    baseDomain: stackEnv('TENANTRY_BASE_DOMAIN', 'tenantry.localhost'),
    company: {
      issuer: `${stackEnv('TENANTRY_AUTH_URL')}/realms/corp-demo`,
      clientSecret: stackEnv('CORP_DEMO_CLIENT_SECRET'),
    },
    setTxt: (name, value) => {
      setTxt(ZONE_FILE, name, value, zoneOut, reloadDns);
    },
  });
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
      'client-secret-env': { type: 'string' },
      slug: { type: 'string' },
      name: { type: 'string' },
      'admin-email': { type: 'string' },
      'dry-run': { type: 'boolean' },
    },
  });
  if (values['client-secret']) {
    throw new Error(
      'Do not put the secret on the command line. Set it in an environment variable and pass --client-secret-env <NAME>.',
    );
  }
  const [group, command, ...rest] = positionals;
  const need = (name: keyof typeof values): string => {
    const value = values[name];
    if (typeof value !== 'string' || !value) throw new Error(`--${name} is required.\n\n${USAGE}`);
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
  if (group === 'seed') return run(seedWith);
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
          clientSecret: secretFrom(values['client-secret-env'], (key) => stackEnv(key, '') || undefined),
        }),
      );
    case 'enterprise provision':
      return provisionEnterprise(enterpriseDeps(), {
        slug: need('slug'),
        name: need('name'),
        adminEmail: need('admin-email'),
      });
    case 'enterprise upgrade':
      return upgradeEnterprise(enterpriseDeps(), {
        ...(values.tenant ? { tenant: values.tenant } : {}),
        dryRun: values['dry-run'] === true,
      });
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
