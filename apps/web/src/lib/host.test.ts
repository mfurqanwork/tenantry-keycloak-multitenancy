import { describe, expect, it } from 'vitest';
import { apexAuthConfig, apexPage, demoWorkspaces, hostKind } from './host.js';

const base = 'tenantry.localhost';

describe('hostKind', () => {
  it('finds the tenant in the subdomain', () => {
    expect(hostKind('acme.tenantry.localhost', base)).toEqual({ kind: 'tenant', slug: 'acme' });
    expect(hostKind('ACME.tenantry.localhost.', base)).toEqual({ kind: 'tenant', slug: 'acme' });
  });

  it('treats the base domain itself as the signup host', () => {
    expect(hostKind('tenantry.localhost', base)).toEqual({ kind: 'apex' });
  });
});

describe('apexAuthConfig', () => {
  it('signs in to the platform realm on the auth host, same scheme and port', () => {
    expect(apexAuthConfig(new URL('http://tenantry.localhost:8080/'), base)).toEqual({
      issuer: 'http://auth.tenantry.localhost:8080/realms/platform',
      clientId: 'tenantry-web',
      organization: null,
    });
  });
});

describe('apexPage', () => {
  it('shows the welcome page at the root, signed out', () => {
    expect(apexPage('/')).toBe('welcome');
    expect(apexPage('/anything-else')).toBe('welcome');
  });
});

describe('demoWorkspaces', () => {
  it('reads a comma-separated list of slugs', () => {
    expect(demoWorkspaces(' acme, globex ,initech ')).toEqual(['acme', 'globex', 'initech']);
  });
});
