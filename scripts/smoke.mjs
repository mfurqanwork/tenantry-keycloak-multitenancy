// Checks the running stack from the host. Each check prints PASS or FAIL; any FAIL exits non-zero.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureEnv, ROOT } from './lib/env.mjs';
import { getVia } from './lib/http.mjs';

const env = ensureEnv();
process.env.TENANTRY_HTTP_PORT ??= env.TENANTRY_HTTP_PORT ?? '80';
const authUrl = env.TENANTRY_AUTH_URL ?? 'http://auth.tenantry.localhost';
const expectedIssuer = `${authUrl}/realms/platform`;
const authHost = new URL(authUrl).hostname;

const checks = [
  [
    'platform realm discovery doc has the public issuer',
    async () => {
      const res = await getVia(authHost, '/realms/platform/.well-known/openid-configuration');
      if (res.status !== 200) return `status ${res.status}`;
      const { issuer } = JSON.parse(res.body);
      return issuer === expectedIssuer || `issuer ${issuer}, expected ${expectedIssuer}`;
    },
  ],
  [
    'mailpit answers',
    async () => {
      const res = await getVia('mail.tenantry.localhost', '/');
      return res.status === 200 || `status ${res.status}`;
    },
  ],
  ...['tenantry.localhost', 'demo.tenantry.localhost', 'demo.portal.tenantry.localhost'].map((host) => [
    `${host} serves the app shell`,
    async () => {
      const res = await getVia(host, '/');
      return (res.status === 200 && res.body.includes('<div id="root">')) || `status ${res.status}`;
    },
  ]),
  [
    'api health is ok behind the tenant host',
    async () => {
      const res = await getVia('demo.tenantry.localhost', '/api/health');
      return (
        (res.status === 200 && JSON.parse(res.body).status === 'ok') || `status ${res.status}: ${res.body}`
      );
    },
  ],
  [
    'the api container sees the same issuer as the browser',
    async () => {
      const script = `fetch(${JSON.stringify(`${expectedIssuer}/.well-known/openid-configuration`)}).then(r=>r.json()).then(d=>console.log(d.issuer))`;
      const issuer = execFileSync(
        'docker',
        [
          'compose',
          '-f',
          'infra/docker-compose.yml',
          '--env-file',
          '.env',
          'exec',
          '-T',
          'api',
          'node',
          '-e',
          script,
        ],
        { cwd: fileURLToPath(ROOT) },
      )
        .toString()
        .trim();
      return issuer === expectedIssuer || `inside docker: ${issuer}`;
    },
  ],
];

let failed = 0;
for (const [name, check] of checks) {
  let result;
  try {
    result = await check();
  } catch (err) {
    result = err.message;
  }
  if (result === true) console.log(`PASS ${name}`);
  else {
    failed++;
    console.log(`FAIL ${name}: ${result}`);
  }
}
process.exit(failed ? 1 : 0);
