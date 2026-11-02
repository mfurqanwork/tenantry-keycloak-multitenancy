// Starts the local stack. Default: everything in Docker. --infra: only Caddy, Keycloak, Postgres and
// Mailpit, with Caddy forwarding app traffic to the API and Vite servers running on the host.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureEnv, ROOT } from './lib/env.mjs';
import { isPortFree } from './lib/port.mjs';

const infraOnly = process.argv.includes('--infra');
const env = ensureEnv();
const port = Number(env.TENANTRY_HTTP_PORT ?? 80);
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
if (!ourCaddy && !(await isPortFree(port))) {
  console.error(
    `Port ${port} is in use. Set TENANTRY_HTTP_PORT and TENANTRY_AUTH_URL (with the port) in .env, then rerun.`,
  );
  process.exit(1);
}

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

run(['up', '-d', '--build', '--wait', ...(infraOnly ? ['caddy', 'keycloak', 'postgres', 'mailpit'] : [])]);
if (infraOnly) run(['run', '--rm', '--build', 'migrate']);
console.log(`\nTenantry is up: http://demo.tenantry.localhost${port === 80 ? '' : `:${port}`}`);
