import { describe, expect, it } from 'vitest';
import { appClientRepresentation, newAppClientId, type AppClientSpec } from './app-clients.js';

const spec = (over: Partial<AppClientSpec>): AppClientSpec => ({
  name: 'HR portal',
  type: 'web',
  redirectUris: ['https://hr.initech.test/callback'],
  postLogoutRedirectUris: ['https://hr.initech.test/', 'https://hr.initech.test/bye'],
  webOrigins: [],
  ...over,
});

describe('customer app clients', () => {
  it('makes ids of the form app-<8 hex>', () => {
    expect(newAppClientId()).toMatch(/^app-[0-9a-f]{8}$/);
    expect(newAppClientId()).not.toBe(newAppClientId());
  });

  it('every type is marked as a customer app, with no role scope and no implicit or password grant', () => {
    for (const type of ['web', 'spa', 'native', 'm2m'] as const) {
      const c = appClientRepresentation('app-0a1b2c3d', spec({ type }));
      expect(c).toMatchObject({
        clientId: 'app-0a1b2c3d',
        name: 'HR portal',
        protocol: 'openid-connect',
        fullScopeAllowed: false,
        implicitFlowEnabled: false,
        directAccessGrantsEnabled: false,
        frontchannelLogout: false,
      });
      expect((c['attributes'] as Record<string, string>)['tenantry.app']).toBe('true');
      expect(c).not.toHaveProperty('secret');
    }
  });

  it('web: confidential, authorization code only', () => {
    const c = appClientRepresentation('app-1', spec({ type: 'web' }));
    expect(c).toMatchObject({
      publicClient: false,
      standardFlowEnabled: true,
      serviceAccountsEnabled: false,
    });
    expect((c['attributes'] as Record<string, string>)['post.logout.redirect.uris']).toBe(
      'https://hr.initech.test/##https://hr.initech.test/bye',
    );
  });

  it('spa: public with PKCE, web origins from the redirect URIs unless given', () => {
    const c = appClientRepresentation('app-1', spec({ type: 'spa' }));
    expect(c).toMatchObject({ publicClient: true, standardFlowEnabled: true, serviceAccountsEnabled: false });
    expect((c['attributes'] as Record<string, string>)['pkce.code.challenge.method']).toBe('S256');
    expect(c['webOrigins']).toEqual(['https://hr.initech.test']);
    const given = appClientRepresentation('app-1', spec({ type: 'spa', webOrigins: ['https://x.test'] }));
    expect(given['webOrigins']).toEqual(['https://x.test']);
  });

  it('native: keeps only the web origins it is given (the portal, for its test sign-in)', () => {
    const c = appClientRepresentation(
      'app-1',
      spec({ type: 'native', redirectUris: ['com.initech.hr:/cb'], webOrigins: ['http://acme.portal.test'] }),
    );
    expect(c['webOrigins']).toEqual(['http://acme.portal.test']);
  });

  it('native: public with PKCE and no web origins', () => {
    const c = appClientRepresentation(
      'app-1',
      spec({ type: 'native', redirectUris: ['com.initech.hr:/cb'] }),
    );
    expect(c).toMatchObject({ publicClient: true, standardFlowEnabled: true, webOrigins: [] });
    expect((c['attributes'] as Record<string, string>)['pkce.code.challenge.method']).toBe('S256');
  });

  it('m2m: confidential, client credentials only, no browser flow', () => {
    const c = appClientRepresentation(
      'app-1',
      spec({ type: 'm2m', redirectUris: [], postLogoutRedirectUris: [] }),
    );
    expect(c).toMatchObject({
      publicClient: false,
      standardFlowEnabled: false,
      serviceAccountsEnabled: true,
      redirectUris: [],
    });
  });
});
