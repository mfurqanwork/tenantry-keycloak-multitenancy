import { describe, expect, it } from 'vitest';
import { tenantOrigin } from './origins.js';

describe('tenantOrigin', () => {
  it('builds the tenant address from the public scheme, base domain and port', () => {
    expect(
      tenantOrigin('acme', {
        authUrl: 'http://auth.tenantry.localhost:8080',
        baseDomain: 'tenantry.localhost',
        publicPort: 8080,
      }),
    ).toBe('http://acme.tenantry.localhost:8080');
    expect(
      tenantOrigin('acme', {
        authUrl: 'https://auth.example.com',
        baseDomain: 'example.com',
        publicPort: null,
      }),
    ).toBe('https://acme.example.com');
  });
});

describe('tenantOrigin for the portal', () => {
  it('puts the portal under the tenant label', () => {
    expect(
      tenantOrigin(
        'acme',
        {
          authUrl: 'http://auth.tenantry.localhost:8080',
          baseDomain: 'tenantry.localhost',
          publicPort: 8080,
        },
        'portal',
      ),
    ).toBe('http://acme.portal.tenantry.localhost:8080');
  });
});
