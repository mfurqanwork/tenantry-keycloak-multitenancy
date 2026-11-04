import { describe, expect, it } from 'vitest';
import { APP_TYPES, confidential, normaliseUris, uriProblem, userSignIn, type AppType } from './apps.js';

describe('app types', () => {
  it('knows the four OIDC types, which sign people in and which hold a secret', () => {
    expect(APP_TYPES).toEqual(['web', 'spa', 'native', 'm2m']);
    expect(APP_TYPES.filter(userSignIn)).toEqual(['web', 'spa', 'native']);
    expect(APP_TYPES.filter(confidential)).toEqual(['web', 'm2m']);
  });
});

describe('redirect URIs', () => {
  it.each<[string, AppType]>([
    ['https://hr.initech.com/callback', 'web'],
    ['https://hr.initech.com:8443/cb', 'spa'],
    ['http://127.0.0.1:4000/callback', 'web'],
    ['http://[::1]:7000/cb', 'native'],
    ['com.initech.hr:/callback', 'native'],
  ])('accepts %s for %s', (uri, type) => {
    expect(uriProblem(uri, 'redirect', type)).toBeNull();
  });

  it.each<[string, AppType, string]>([
    ['http://hr.initech.com/cb', 'web', 'Use https (http only for 127.0.0.1 or [::1]).'],
    ['http://localhost:4000/cb', 'web', 'Use 127.0.0.1 instead of localhost.'],
    ['https://*.initech.com/cb', 'web', 'No wildcards in the host.'],
    ['https://hr.initech.com/cb#x', 'spa', 'No fragment (#) in a redirect URI.'],
    ['com.initech.hr:/cb', 'spa', 'Custom schemes are for mobile and desktop apps.'],
    ['myapp:/cb', 'native', 'A custom scheme needs a dot, like com.example.app.'],
    ['not a uri', 'web', 'Enter a full URI.'],
    ['https:*.evil.test/cb', 'web', 'No wildcards in the host.'],
    ['https:/*.evil.test/cb', 'web', 'No wildcards in the host.'],
    ['https:\\\\*.evil.test/cb', 'web', 'No wildcards in the host.'],
    ['http:127.0.0.1:4000/cb', 'web', 'Enter a full URI.'],
    ['https://hr.initech.com/*', 'web', 'No wildcards in a redirect URI.'],
    ['com.initech.hr:/*', 'native', 'No wildcards in a redirect URI.'],
  ])('refuses %s for %s', (uri, type, message) => {
    expect(uriProblem(uri, 'redirect', type)).toBe(message);
  });
});

describe('web origins', () => {
  it('accepts scheme, host and port only', () => {
    expect(uriProblem('https://hr.initech.com:8443', 'origin', 'spa')).toBeNull();
    expect(uriProblem('https://hr.initech.com/path', 'origin', 'spa')).toBe('An origin has no path.');
    expect(uriProblem('com.initech.hr:/cb', 'origin', 'native')).toBe('Enter a full URI.');
  });
});

describe('normaliseUris', () => {
  it('trims and de-duplicates', () => {
    expect(normaliseUris([' https://a.test/cb ', 'https://a.test/cb', ''])).toEqual(['https://a.test/cb']);
  });
});
