import { describe, expect, it } from 'vitest';
import { appBody } from './apps.schemas.js';

const issues = (body: unknown) => {
  const parsed = appBody.safeParse(body);
  return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('appBody', () => {
  it('cleans the URI lists before checking them', () => {
    const parsed = appBody.parse({
      name: '  HR portal ',
      type: 'spa',
      redirectUris: [' https://hr.test/cb ', 'https://hr.test/cb'],
    });
    expect(parsed).toEqual({
      name: 'HR portal',
      type: 'spa',
      redirectUris: ['https://hr.test/cb'],
      postLogoutRedirectUris: [],
      webOrigins: [],
    });
  });

  it('names the field and position of a bad URI', () => {
    expect(
      issues({ name: 'HR', type: 'web', redirectUris: ['https://hr.test/cb', 'http://localhost:3000/cb'] }),
    ).toEqual(['redirectUris.1: Use 127.0.0.1 instead of localhost.']);
    expect(
      issues({
        name: 'HR',
        type: 'spa',
        redirectUris: ['https://hr.test/cb'],
        webOrigins: ['https://hr.test/x'],
      }),
    ).toEqual(['webOrigins.0: An origin has no path.']);
  });

  it('needs a redirect URI for apps people sign in to, and none for machine to machine', () => {
    expect(issues({ name: 'HR', type: 'native', redirectUris: [] })).toEqual([
      'redirectUris: Add at least one redirect URI.',
    ]);
    expect(issues({ name: 'Sync', type: 'm2m', redirectUris: ['https://x.test/cb'] })).toEqual([
      'redirectUris: Machine-to-machine apps have no redirect URIs.',
    ]);
    expect(issues({ name: 'Sync', type: 'm2m' })).toEqual([]);
  });

  it('caps names and lists', () => {
    expect(issues({ name: '', type: 'm2m' })).toEqual(['name: Enter a name.']);
    expect(issues({ name: 'x'.repeat(81), type: 'm2m' })).toEqual(['name: Use at most 80 characters.']);
    const many = Array.from({ length: 11 }, (_, i) => `https://hr.test/cb${String(i)}`);
    expect(issues({ name: 'HR', type: 'web', redirectUris: many })).toEqual([
      'redirectUris: Use at most 10.',
    ]);
    expect(issues({ name: 'HR', type: 'saml' })).toHaveLength(1);
  });
});
