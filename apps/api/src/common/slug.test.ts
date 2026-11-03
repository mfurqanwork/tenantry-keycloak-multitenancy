import { describe, expect, it } from 'vitest';
import { validateSlug } from './slug.js';

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
