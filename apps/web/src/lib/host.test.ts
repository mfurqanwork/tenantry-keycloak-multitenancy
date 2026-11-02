import { describe, expect, it } from 'vitest';
import { apexAuthConfig, hostKind } from './host.js';

const base = 'tenantry.localhost';

describe('hostKind', () => {
  it('finds the tenant in the subdomain', () => {
    expect(hostKind('acme.tenantry.localhost', base)).toEqual({ kind: 'tenant', slug: 'acme' });
    expect(hostKind('ACME.tenantry.localhost.', base)).toEqual({ kind: 'tenant', slug: 'acme' });
  });

  it('treats the base domain itself as the signup host', () => {
    expect(hostKind('tenantry.localhost', base)).toEqual({ kind: 'apex' });
  });

  it('knows nothing about other hosts', () => {
    expect(hostKind('a.b.tenantry.localhost', base)).toEqual({ kind: 'unknown' });
    expect(hostKind('evil.com', base)).toEqual({ kind: 'unknown' });
    expect(hostKind('localhost', base)).toEqual({ kind: 'unknown' });
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
