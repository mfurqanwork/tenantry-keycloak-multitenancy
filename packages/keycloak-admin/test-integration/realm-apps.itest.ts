import { createRealmApps } from '../src/realms/realm-apps.js';
import { runRealmAppsContract } from '../src/testing/apps-contract.js';
import { baseUrl, bootstrap, provisionTestRealm } from './stack.js';

runRealmAppsContract('Keycloak realm', async () => {
  const { realm, secret } = await provisionTestRealm('ac', 'Apps Contract');
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
