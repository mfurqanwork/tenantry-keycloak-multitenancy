// Checks the live site from outside, over its real addresses. Usage: node scripts/smoke-live.mjs <base domain> <version>
import { connect } from 'node:net';
import { checkAll } from './lib/smoke-live.mjs';

const [base, version] = process.argv.slice(2);
if (!base || !version) {
  console.error('Usage: node scripts/smoke-live.mjs <base domain> <version>');
  process.exit(1);
}

const page = (url, init) => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...init });
const shell = async (host) => {
  const res = await page(`https://${host}/`);
  const body = await res.text();
  return (res.status === 200 && body.includes('<div id="root">')) || `status ${res.status}`;
};
const closed = (port) =>
  new Promise((resolve) => {
    const socket = connect({ host: base, port, timeout: 3000 });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.on('connect', () => done(`port ${port} is open`));
    socket.on('timeout', () => done(true));
    socket.on('error', () => done(true));
  });

const issuer = `https://auth.${base}/realms/platform`;
const failed = await checkAll([
  [
    'Keycloak reports the public issuer',
    async () => {
      const doc = await (await page(`${issuer}/.well-known/openid-configuration`)).json();
      return doc.issuer === issuer || `issuer ${doc.issuer}`;
    },
  ],
  [
    'the login page comes from the tenantry theme',
    async () => {
      const query = new URLSearchParams({
        client_id: 'tenantry-web',
        response_type: 'code',
        scope: 'openid',
        redirect_uri: `https://${base}/auth/callback`,
        code_challenge: 'smoke-check-code-challenge-0123456789abcdefghij',
        code_challenge_method: 'S256',
      });
      const res = await page(`${issuer}/protocol/openid-connect/auth?${query}`);
      return (
        (res.status === 200 && (await res.text()).includes('/login/tenantry/')) || `status ${res.status}`
      );
    },
  ],
  [`${base} serves the app`, () => shell(base)],
  [`acme.${base} serves the app`, () => shell(`acme.${base}`)],
  [`acme.portal.${base} serves the app`, () => shell(`acme.portal.${base}`)],
  [
    `the API is healthy and running ${version}`,
    async () => {
      const body = await (await page(`https://acme.${base}/api/health`)).json();
      return (body.status === 'ok' && body.version === version) || JSON.stringify(body);
    },
  ],
  [
    'plain http redirects to https',
    async () => {
      const res = await page(`http://${base}/`);
      return (
        (res.status >= 300 && res.status < 400 && res.headers.get('location')?.startsWith('https://')) ||
        `status ${res.status}`
      );
    },
  ],
  [
    'browsers are told to stay on https',
    async () =>
      Boolean((await page(`https://${base}/`)).headers.get('strict-transport-security')) || 'no HSTS',
  ],
  ['Postgres is not reachable', () => closed(5432)],
  ['Keycloak is not reachable directly', () => closed(8080)],
]);
process.exit(failed ? 1 : 0);
