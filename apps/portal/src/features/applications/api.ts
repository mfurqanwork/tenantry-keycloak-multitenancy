import type { AppType } from '@tenantry/auth';

// GET /api/apps/:id (ADR-0011). No secret is ever part of it.
export interface AppView {
  id: string;
  clientId: string;
  name: string;
  type: AppType;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  webOrigins: string[];
  createdAt: string;
  updatedAt: string;
  connection: {
    issuer: string;
    discoveryUrl: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    jwksUri: string;
    endSessionEndpoint: string;
    clientId: string;
    scopes: string;
    testRedirectUri: string | null;
  };
}

export interface AppInput {
  name: string;
  type: AppType;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  webOrigins: string[];
}

export const TYPE_LABELS: Record<AppType, string> = {
  web: 'Web app',
  spa: 'Single-page app',
  native: 'Mobile or desktop app',
  m2m: 'Machine to machine',
};

export const TYPE_HELP: Record<AppType, string> = {
  web: 'A server-side app or backend-for-frontend. It keeps a client secret.',
  spa: 'Runs in the browser (React, Vue, Angular). Signs in with PKCE, no secret.',
  native: 'iOS, Android or desktop. Signs in with PKCE through a custom scheme or 127.0.0.1.',
  m2m: 'A service calling APIs with its own credentials. Nobody signs in.',
};

// The secret travels from the register or rotate call to the detail page in router state only.
export interface SecretState {
  clientSecret?: string;
}
