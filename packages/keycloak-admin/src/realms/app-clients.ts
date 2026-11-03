import { randomBytes } from 'node:crypto';
import { confidential, type AppType } from '@tenantry/auth';

// What a customer asks for; turned into a Keycloak client by appClientRepresentation (ADR-0011).
export interface AppClientSpec {
  name: string;
  type: AppType;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  webOrigins: string[];
}

// Marks a client as a customer app: RealmApps touches no client without it.
export const CUSTOMER_APP_ATTRIBUTE = 'tenantry.app';

export function newAppClientId(): string {
  return `app-${randomBytes(4).toString('hex')}`;
}

const originOf = (uri: string): string | null => {
  try {
    const { protocol, origin } = new URL(uri);
    return protocol === 'https:' || protocol === 'http:' ? origin : null;
  } catch {
    return null;
  }
};

function webOrigins(spec: AppClientSpec): string[] {
  if (spec.type !== 'spa') return spec.type === 'web' ? spec.webOrigins : [];
  if (spec.webOrigins.length > 0) return spec.webOrigins;
  return [...new Set(spec.redirectUris.map(originOf).filter((o): o is string => o !== null))];
}

// No role scope (fullScopeAllowed false, no mappings): a customer app's token never carries our API's
// audience or the person's workspace roles.
export function appClientRepresentation(clientId: string, spec: AppClientSpec): Record<string, unknown> {
  const secretHolder = confidential(spec.type);
  const pkce = spec.type === 'spa' || spec.type === 'native';
  return {
    clientId,
    name: spec.name,
    enabled: true,
    protocol: 'openid-connect',
    publicClient: !secretHolder,
    ...(secretHolder ? { clientAuthenticatorType: 'client-secret' } : {}),
    standardFlowEnabled: spec.type !== 'm2m',
    serviceAccountsEnabled: spec.type === 'm2m',
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    frontchannelLogout: false,
    fullScopeAllowed: false,
    redirectUris: spec.type === 'm2m' ? [] : spec.redirectUris,
    webOrigins: webOrigins(spec),
    attributes: {
      [CUSTOMER_APP_ATTRIBUTE]: 'true',
      'post.logout.redirect.uris': spec.postLogoutRedirectUris.join('##'),
      ...(pkce ? { 'pkce.code.challenge.method': 'S256' } : {}),
    },
  };
}
