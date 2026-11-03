// Starts the local stack. Default: everything in Docker. --infra: only Caddy, Keycloak, Postgres and
// Mailpit, with Caddy forwarding app traffic to the API and Vite servers running on the host.
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ensureEnv, ROOT } from './lib/env.mjs';
import { ensureProvisionerClient } from './lib/provisioner.mjs';
import { busyPorts } from './lib/port.mjs';

const infraOnly = process.argv.includes('--infra');
const env = ensureEnv();
const port = Number(env.TENANTRY_HTTP_PORT ?? 80);
const ports = {
  TENANTRY_HTTP_PORT: port,
  TENANTRY_PG_PORT: Number(env.TENANTRY_PG_PORT ?? 5432),
  TENANTRY_KC_PORT: Number(env.TENANTRY_KC_PORT ?? 8180),
};
const cwd = fileURLToPath(ROOT);
const compose = ['compose', '-f', 'infra/docker-compose.yml', '--env-file', '.env'];

let ourCaddy;
try {
  ourCaddy = execFileSync('docker', [...compose, 'ps', '-q', 'caddy'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .toString()
    .trim();
} catch (err) {
  console.error(
    `Docker is not reachable. Start Docker Desktop, then rerun.\n${err.stderr?.toString() ?? err.message}`,
  );
  process.exit(1);
}
// When our own stack is already up, its containers hold these ports; that is not a conflict.
const busy = ourCaddy ? [] : await busyPorts(ports);
for (const { name, port: taken } of busy) {
  const hint =
    name === 'TENANTRY_HTTP_PORT'
      ? 'Set TENANTRY_HTTP_PORT and TENANTRY_AUTH_URL (with the port) in .env'
      : name === 'TENANTRY_PG_PORT'
        ? 'Set TENANTRY_PG_PORT and the port in DATABASE_URL and DATABASE_OWNER_URL in .env'
        : 'Set TENANTRY_KC_PORT and TENANTRY_AUTH_INTERNAL_URL in .env';
  console.error(`Port ${taken} is in use. ${hint}, then rerun.`);
}
if (busy.length) process.exit(1);

const upstreams = infraOnly
  ? {
      WEB_UPSTREAM: 'host.docker.internal:5173',
      PORTAL_UPSTREAM: 'host.docker.internal:5174',
      API_UPSTREAM: 'host.docker.internal:3000',
    }
  : {};
const run = (args) =>
  execFileSync('docker', [...compose, ...args], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...upstreams },
  });

// The local DNS server (company login, ADR-0022) needs its zone file before it starts; `pnpm ops dns
// set-txt` adds records to it later. Git ignores it.
const zone = new URL('../infra/dns/zones/test.db', import.meta.url);
if (!existsSync(zone)) {
  writeFileSync(
    zone,
    [
      '$ORIGIN test.',
      '@ 60 IN SOA ns.test. admin.test. 1 7200 3600 1209600 60',
      '@ 60 IN NS ns.test.',
      'ns 60 IN A 127.0.0.1',
      '',
    ].join('\n'),
  );
}

run([
  'up',
  '-d',
  '--build',
  '--wait',
  ...(infraOnly ? ['caddy', 'keycloak', 'postgres', 'mailpit', 'dns'] : []),
]);
if (infraOnly) run(['run', '--rm', '--build', 'migrate']);
// The master-realm account the API creates enterprise realms with (ADR-0010); dev only.
await ensureProvisionerClient({
  baseUrl: env.TENANTRY_AUTH_INTERNAL_URL ?? 'http://127.0.0.1:8180',
  adminUser: env.KC_BOOTSTRAP_ADMIN_USERNAME,
  adminPassword: env.KC_BOOTSTRAP_ADMIN_PASSWORD,
  clientId: env.KEYCLOAK_PROVISIONER_CLIENT_ID ?? 'tenantry-provisioner',
  secret: env.KEYCLOAK_PROVISIONER_CLIENT_SECRET ?? 'dev-provisioner-secret',
});
// Caddy reads its bind-mounted Caddyfile only at start; a restart picks up edits since the last run.
run(['restart', 'caddy']);
console.log(`\nTenantry is up: http://demo.tenantry.localhost${port === 80 ? '' : `:${port}`}`);
