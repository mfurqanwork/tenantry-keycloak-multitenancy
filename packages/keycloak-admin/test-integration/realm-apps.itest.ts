import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createHttpRealmProvisioner } from '../src/realms/provisioner.js';
import { createRealmApps } from '../src/realms/realm-apps.js';
import { loadProductClients, loadRealmTemplate, TEMPLATE_VERSION } from '../src/realms/templates.js';
import { runRealmAppsContract } from '../src/testing/apps-contract.js';

function env(key: string): string {
  const file = new URL('../../../.env', import.meta.url);
  let value = process.env[key];
  if (!value && existsSync(file)) {
    value = new RegExp(`^${key}=(.*)$`, 'm').exec(readFileSync(file, 'utf8'))?.[1]?.trim();
  }
  if (!value) throw new Error(`${key} is not set: copy .env.example to .env`);
  return value;
}

const baseUrl = env('TENANTRY_AUTH_INTERNAL_URL');

async function bootstrap(method: string, path: string): Promise<Response> {
  const { access_token } = (await (
    await fetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: env('KC_BOOTSTRAP_ADMIN_USERNAME'),
        password: env('KC_BOOTSTRAP_ADMIN_PASSWORD'),
      }),
    })
  ).json()) as { access_token: string };
  return fetch(`${baseUrl}/admin/realms${path}`, {
    method,
    headers: { authorization: `Bearer ${access_token}` },
  });
}

runRealmAppsContract('Keycloak realm', async () => {
  const realm = `ent-ac${randomBytes(3).toString('hex')}`;
  const secret = randomBytes(32).toString('base64url');
  const vars = {
    displayName: 'Apps Contract',
    webOrigin: `http://${realm}.tenantry.localhost:8080`,
    portalOrigin: `http://${realm}.portal.tenantry.localhost:8080`,
    smtp: { host: 'mailpit', port: '1025', from: 'no-reply@tenantry.localhost' },
    allowHttpRedirects: true,
  };
  const provisioner = createHttpRealmProvisioner({
    baseUrl,
    clientId: env('KEYCLOAK_PROVISIONER_CLIENT_ID'),
    clientSecret: env('KEYCLOAK_PROVISIONER_CLIENT_SECRET'),
  });
  await provisioner.ensureRealm(realm);
  await provisioner.applyTemplate(realm, loadRealmTemplate(TEMPLATE_VERSION, vars));
  await provisioner.ensureClients(realm, loadProductClients(vars));
  await provisioner.setBackendSecret(realm, secret);
  const [web] = (await (await bootstrap('GET', `/${realm}/clients?clientId=tenantry-web`)).json()) as {
    id: string;
  }[];
  return {
    apps: createRealmApps({ baseUrl, realm, clientSecret: secret }),
    productClientUuid: web?.id ?? '',
    async redirectUrisOf(kcClientUuid) {
      return (
        (await (await bootstrap('GET', `/${realm}/clients/${kcClientUuid}`)).json()) as {
          redirectUris: string[];
        }
      ).redirectUris;
    },
    async cleanup() {
      await bootstrap('DELETE', `/${realm}`);
    },
  };
});
