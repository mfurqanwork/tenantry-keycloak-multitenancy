import { beforeAll, describe, expect, it } from 'vitest';
import { signInForTokens } from './helpers/browser-flow.js';
import { env } from './helpers/env.js';
import { api, tenantHost } from './helpers/http.js';
import { signupTenant, type TestTenant } from './helpers/tenants.js';

// PengOPA signs in with Tenantry (ADR-0032). Its redirect is never followed: the test stops at Keycloak's answer.
const PENGOPA_REDIRECT = 'http://localhost:5180/api/auth/callback/tenantry';

interface IdClaims {
  organization?: Record<string, { groups?: string[] }>;
}

const claims = (jwt: string): IdClaims =>
  JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')) as IdClaims;

let tenant: TestTenant;
let tokens: { access_token: string; id_token: string };

beforeAll(async () => {
  tenant = await signupTenant('pengopa');
  tokens = await signInForTokens({
    realm: 'platform',
    clientId: 'pengopa',
    clientSecret: env('PENGOPA_CLIENT_SECRET', 'dev-pengopa-secret'),
    redirectUri: PENGOPA_REDIRECT,
    scope: 'openid email profile organization',
    username: tenant.owner.email,
    password: tenant.owner.password,
  });
});

describe('guarantee: PengOPA signs in with Tenantry', () => {
  it('names the chosen workspace and its groups in the ID token', () => {
    expect(claims(tokens.id_token).organization?.[tenant.slug]?.groups).toContain('/owners');
  });

  it("refuses PengOPA's token on Tenantry's API", async () => {
    const me = await api(tenantHost(tenant.slug), 'GET', '/api/me', { token: tokens.access_token });
    expect(me.status).toBe(401);
  });
});
