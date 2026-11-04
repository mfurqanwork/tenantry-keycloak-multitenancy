import { bridgeClientId } from '../identity-directory.js';
import { provisionerCalls, type ProvisionerAccess } from './realm-admin-call.js';

export const BRIDGE_ALIAS = 'tenantry-account';
export const BRIDGE_FIRST_LOGIN_FLOW = 'tenantry-bridge-first-login';
export const bridgeSecretKey = (realm: string) => `${realm}/tenantry-bridge`;

// "Continue with your Tenantry account" on a moved workspace's sign-in page (ADR-0025): an OIDC provider
// signing in through the shared realm. Only people pre-linked to it get in: its first-login flow is
// Keycloak's "Deny access", so a stranger with a shared-realm account is refused and nobody new is made.
export interface RealmBridge {
  ensure(input: { slug: string; secret: string }): Promise<void>;
  remove(): Promise<void>;
}

export interface RealmBridgeOptions extends ProvisionerAccess {
  // The address people's browsers use for Keycloak.
  publicAuthUrl: string;
  // Where Keycloak reaches itself for the token and keys (inside its container).
  selfUrl?: string;
  platformRealm?: string;
}

export function createRealmBridge(o: RealmBridgeOptions): RealmBridge {
  const { call, json } = provisionerCalls(o);
  const platform = o.platformRealm ?? 'platform';
  const self = o.selfUrl ?? 'http://localhost:8080';
  const flows = '/authentication/flows';

  async function ensureDenyFlow(): Promise<void> {
    const all = await json<{ alias: string }[]>(await call('ensureBridge', 'GET', flows));
    if (!all.some((f) => f.alias === BRIDGE_FIRST_LOGIN_FLOW)) {
      await call('ensureBridge', 'POST', flows, {
        alias: BRIDGE_FIRST_LOGIN_FLOW,
        description: 'Refuses anyone the bridge has not been linked to (ADR-0025).',
        providerId: 'basic-flow',
        topLevel: true,
        builtIn: false,
      });
    }
    const executions = `${flows}/${encodeURIComponent(BRIDGE_FIRST_LOGIN_FLOW)}/executions`;
    let found = await json<{ id: string; providerId?: string; requirement: string }[]>(
      await call('ensureBridge', 'GET', executions),
    );
    if (!found.some((e) => e.providerId === 'deny-access-authenticator')) {
      await call('ensureBridge', 'POST', `${executions}/execution`, {
        provider: 'deny-access-authenticator',
      });
      found = await json(await call('ensureBridge', 'GET', executions));
    }
    for (const e of found) {
      if (e.providerId === 'deny-access-authenticator' && e.requirement !== 'REQUIRED') {
        await call('ensureBridge', 'PUT', executions, { ...e, requirement: 'REQUIRED' });
      }
    }
  }

  return {
    async ensure({ slug, secret }) {
      await ensureDenyFlow();
      const oidc = `/realms/${platform}/protocol/openid-connect`;
      const representation = {
        alias: BRIDGE_ALIAS,
        displayName: 'Continue with your Tenantry account',
        providerId: 'oidc',
        enabled: true,
        trustEmail: true,
        firstBrokerLoginFlowAlias: BRIDGE_FIRST_LOGIN_FLOW,
        config: {
          authorizationUrl: `${o.publicAuthUrl}${oidc}/auth`,
          tokenUrl: `${self}${oidc}/token`,
          jwksUrl: `${self}${oidc}/certs`,
          logoutUrl: `${o.publicAuthUrl}${oidc}/logout`,
          issuer: `${o.publicAuthUrl}/realms/${platform}`,
          useJwksUrl: 'true',
          validateSignature: 'true',
          clientId: bridgeClientId(slug),
          clientSecret: secret,
          clientAuthMethod: 'client_secret_post',
          defaultScope: 'openid email profile',
          pkceEnabled: 'true',
          pkceMethod: 'S256',
          syncMode: 'IMPORT',
        },
      };
      const path = `/identity-provider/instances/${BRIDGE_ALIAS}`;
      const existing = await call('ensureBridge', 'GET', path, undefined, [404]);
      if (existing.status === 404) {
        await call('ensureBridge', 'POST', '/identity-provider/instances', representation);
      } else {
        await call('ensureBridge', 'PUT', path, { ...(await json<object>(existing)), ...representation });
      }
    },

    async remove() {
      await call('removeBridge', 'DELETE', `/identity-provider/instances/${BRIDGE_ALIAS}`, undefined, [404]);
      const all = await json<{ id: string; alias: string }[]>(await call('removeBridge', 'GET', flows));
      const flow = all.find((f) => f.alias === BRIDGE_FIRST_LOGIN_FLOW);
      if (flow) await call('removeBridge', 'DELETE', `${flows}/${flow.id}`, undefined, [404]);
    },
  };
}
