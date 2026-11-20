import { describe, expect, it } from 'vitest';
import { cleanEvent, cleanUrl } from './analytics.js';

describe('analytics URLs', () => {
  it('keep campaign tags and lose sign-in codes, states and hashes', () => {
    expect(cleanUrl('https://acme.tenantry.pengopal.com/auth/callback?code=abc&state=xyz&utm_source=linkedin#x')).toBe(
      'https://acme.tenantry.pengopal.com/auth/callback?utm_source=linkedin',
    );
    expect(cleanUrl('/applications/test-callback?code=abc')).toBe('/applications/test-callback');
    expect(cleanUrl('$direct')).toBe('$direct');
  });

  it("are cleaned in an event's properties and person properties", () => {
    const event = cleanEvent({
      uuid: '1',
      event: '$pageview',
      properties: { $current_url: 'https://acme.tenantry.pengopal.com/?code=abc' },
      $set_once: { $initial_current_url: 'https://acme.tenantry.pengopal.com/auth/callback?code=abc' },
    });
    expect(event?.properties['$current_url']).toBe('https://acme.tenantry.pengopal.com/');
    expect(event?.$set_once?.['$initial_current_url']).toBe('https://acme.tenantry.pengopal.com/auth/callback');
  });
});
