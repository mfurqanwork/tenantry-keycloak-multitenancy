import { describe, expect, it } from 'vitest';
import { tenantOrigin, validateSlug } from './slug.js';

describe('validateSlug', () => {
  it('accepts a plain slug', () => {
    expect(validateSlug('acme')).toEqual({ ok: true });
    expect(validateSlug('acme-2')).toEqual({ ok: true });
  });

  it.each(['a', '-acme', 'acme-', 'Acme', 'ac me', 'acme.co', 'x'.repeat(33), '1acme'])(
    'refuses %j as a format problem',
    (slug) => {
      expect(validateSlug(slug)).toEqual({ ok: false, reason: 'format' });
    },
  );

  it.each(['www', 'auth', 'mail', 'api', 'portal', 'app', 'admin', 'tenantry'])('reserves %j', (slug) => {
    expect(validateSlug(slug)).toEqual({ ok: false, reason: 'reserved' });
  });
});

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
