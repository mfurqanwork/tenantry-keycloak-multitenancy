import { describe, expect, it } from 'vitest';
import { loadProductClients, loadRealmTemplate, MAPPED_GROUPS, TEMPLATE_VERSION } from './templates.js';

const vars = {
  displayName: 'Initech',
  webOrigin: 'http://initech.tenantry.localhost:8080',
  portalOrigin: 'http://initech.portal.tenantry.localhost:8080',
  smtp: { host: 'mailpit', port: '1025', from: 'no-reply@tenantry.localhost' },
  allowHttpRedirects: true,
};

describe('realm templates', () => {
  it('fills in the realm settings and keeps the policies typed', () => {
    const t = loadRealmTemplate(TEMPLATE_VERSION, vars);
    expect(t.version).toBe(3);
    expect(t.realm['displayName']).toBe('Initech');
    expect(t.realm['smtpServer']).toEqual({
      host: 'mailpit',
      port: '1025',
      from: 'no-reply@tenantry.localhost',
      fromDisplayName: 'Initech',
    });
    expect(JSON.stringify(t)).not.toContain('${');
  });

  it('enforces secure redirect URIs, https only, wherever http is not allowed', () => {
    const t = loadRealmTemplate(TEMPLATE_VERSION, { ...vars, allowHttpRedirects: false });
    const profiles = JSON.stringify(t.clientProfiles);
    expect(profiles).toContain('"executor":"secure-redirect-uris-enforcer"');
    expect(profiles).toContain('"allow-http-scheme":false');
  });

  it('v2 checks redirect URIs on every client, allowing custom schemes and loopback for native apps', () => {
    const t = loadRealmTemplate(TEMPLATE_VERSION, { ...vars, allowHttpRedirects: false });
    const profile = (name: string) =>
      t.clientProfiles.profiles.find((p) => p['name'] === name) as {
        executors: { executor: string; configuration: Record<string, unknown> }[];
      };
    expect(profile('tenantry-public-clients').executors.map((e) => e.executor)).toEqual(['pkce-enforcer']);
    const enforcer = profile('tenantry-all-clients').executors.find(
      (e) => e.executor === 'secure-redirect-uris-enforcer',
    );
    expect(enforcer?.configuration).toMatchObject({
      'allow-http-scheme': false,
      'allow-private-use-uri-scheme': true,
      'allow-loopback-interface': true,
    });
  });

  it('leaves the redirect URI enforcer out for local http, whose *.localhost hosts are loopback', () => {
    const profiles = JSON.stringify(loadRealmTemplate(TEMPLATE_VERSION, vars).clientProfiles);
    expect(profiles).not.toContain('secure-redirect-uris-enforcer');
    expect(profiles).toContain('"executor":"pkce-enforcer"');
  });

  it('v3 describes the second sign-in step on the built-in browser flow, optional by default', () => {
    const t = loadRealmTemplate(TEMPLATE_VERSION, vars);
    expect(t.twoStep).toBe('optional');
    expect(t.secondStep).toEqual({
      flow: 'browser',
      subflow: 'Browser - Conditional 2FA',
      conditions: ['Condition - user configured', 'Condition - credential'],
      otp: 'OTP Form',
      others: ['WebAuthn Authenticator', 'Recovery Authentication Code Form'],
    });
  });

  it('maps the two directory groups to roles, never to owner', () => {
    expect(MAPPED_GROUPS).toEqual({ 'tenantry-members': 'member', 'tenantry-admins': 'admin' });
  });

  it("puts the tenant's two origins on its app clients", () => {
    const clients = loadProductClients(vars);
    const web = clients.find((c) => c.representation['clientId'] === 'tenantry-web');
    expect(web?.representation['redirectUris']).toEqual(['http://initech.tenantry.localhost:8080/*']);
    const portal = clients.find((c) => c.representation['clientId'] === 'tenantry-portal');
    expect(portal?.representation['webOrigins']).toEqual(['http://initech.portal.tenantry.localhost:8080']);
    expect(JSON.stringify(clients)).not.toContain('${');
  });

  it('separates client roles and service-account roles from the client representation', () => {
    const clients = loadProductClients(vars);
    const api = clients.find((c) => c.representation['clientId'] === 'tenantry-api');
    expect(api?.roles).toEqual(['owner', 'admin', 'member']);
    expect(api?.representation['roles']).toBeUndefined();
    const backend = clients.find((c) => c.representation['clientId'] === 'tenantry-backend');
    expect(backend?.serviceAccountRoles).toEqual(['manage-users', 'view-users', 'manage-clients']);
    expect(backend?.representation['serviceAccountRealmManagementRoles']).toBeUndefined();
  });

  it('knows no template version it does not ship', () => {
    expect(() => loadRealmTemplate(99, vars)).toThrow(/version 99/);
  });
});
