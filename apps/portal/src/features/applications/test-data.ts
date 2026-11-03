import type { AppView } from './api.js';

export function sampleApp(over: Partial<AppView> = {}): AppView {
  const issuer = 'http://auth.tenantry.localhost/realms/ent-acme';
  const clientId = over.clientId ?? 'app-0a1b2c3d';
  return {
    id: 'a1',
    clientId,
    name: 'HR portal',
    type: 'web',
    redirectUris: ['https://hr.acme.test/callback'],
    postLogoutRedirectUris: [],
    webOrigins: [],
    createdAt: '2026-11-03T10:00:00.000Z',
    updatedAt: '2026-11-03T10:00:00.000Z',
    connection: {
      issuer,
      discoveryUrl: `${issuer}/.well-known/openid-configuration`,
      authorizationEndpoint: `${issuer}/protocol/openid-connect/auth`,
      tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
      jwksUri: `${issuer}/protocol/openid-connect/certs`,
      endSessionEndpoint: `${issuer}/protocol/openid-connect/logout`,
      clientId,
      scopes: 'openid profile email',
      testRedirectUri:
        (over.type ?? 'web') === 'm2m'
          ? null
          : 'http://acme.portal.tenantry.localhost/applications/test-callback',
    },
    ...over,
  };
}
