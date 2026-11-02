// Checks the running stack from the host. Each check prints PASS or FAIL; any FAIL exits non-zero.
import { ensureEnv } from './lib/env.mjs';
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
