import { describe, expect, it } from 'vitest';
import { loadProductClients, loadRealmTemplate, TEMPLATE_VERSION } from './templates.js';

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
    expect(t.version).toBe(1);
    expect(t.realm['displayName']).toBe('Initech');
    expect(t.realm['smtpServer']).toEqual({
      host: 'mailpit',
      port: '1025',
      from: 'no-reply@tenantry.localhost',
      fromDisplayName: 'Initech',
    });
    const profiles = JSON.stringify(t.clientProfiles);
    expect(profiles).toContain('"allow-http-scheme":true');
    expect(JSON.stringify(t)).not.toContain('${');
  });

  it('refuses http redirects unless allowed', () => {
    const t = loadRealmTemplate(TEMPLATE_VERSION, { ...vars, allowHttpRedirects: false });
    expect(JSON.stringify(t.clientProfiles)).toContain('"allow-http-scheme":false');
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
