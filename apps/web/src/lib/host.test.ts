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
  it('shows the welcome page at the root and signup at its own paths', () => {
    expect(apexPage('/')).toBe('welcome');
    expect(apexPage('/signup')).toBe('signup');
    expect(apexPage('/auth/callback')).toBe('signup');
  });

  it('says page not found for any other path, rather than showing the welcome page', () => {
    expect(apexPage('/anything-else')).toBe('not-found');
    expect(apexPage('/sign-in')).toBe('not-found');
  });
});

describe('demoWorkspaces', () => {
  it('reads a comma-separated list of slugs', () => {
    expect(demoWorkspaces(' acme, globex ,initech ')).toEqual(['acme', 'globex', 'initech']);
  });
});
