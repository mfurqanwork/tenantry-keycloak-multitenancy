import { describe, expect, it } from 'vitest';
import { bearerToken, isDeactivation, rewriteLocation } from './scim-gateway.service.js';

describe('isDeactivation', () => {
  it('sees active false in a PUT body', () => {
    expect(isDeactivation({ userName: 'a', active: false })).toBe(true);
    expect(isDeactivation({ userName: 'a', active: true })).toBe(false);
    expect(isDeactivation({ userName: 'a' })).toBe(false);
  });

  it('entra-style deactivate: Replace, path active, the string False', () => {
    expect(isDeactivation({ Operations: [{ op: 'Replace', path: 'active', value: 'False' }] })).toBe(true);
    expect(isDeactivation({ Operations: [{ op: 'replace', path: 'active', value: 'True' }] })).toBe(false);
  });

  it('sees active false inside a value with no path (Okta)', () => {
    expect(isDeactivation({ Operations: [{ op: 'replace', value: { active: false } }] })).toBe(true);
    expect(isDeactivation({ Operations: [{ op: 'replace', value: { displayName: 'x' } }] })).toBe(false);
  });

  it('is false for anything that is not an object', () => {
    expect(isDeactivation(null)).toBe(false);
    expect(isDeactivation('active=false')).toBe(false);
  });
});

describe('rewriteLocation', () => {
  it("swaps Keycloak's SCIM base for the gateway's", () => {
    const from = 'http://auth.test/realms/ent-a/scim/v2';
    const to = 'http://a.tenantry.localhost/scim/v2';
    expect(rewriteLocation(`{"meta":{"location":"${from}/Users/1"}}`, from, to)).toBe(
      `{"meta":{"location":"${to}/Users/1"}}`,
    );
    expect(rewriteLocation(`${from}/Users/1 and ${from}/Groups/2`, from, to)).toBe(
      `${to}/Users/1 and ${to}/Groups/2`,
    );
  });
});

describe('bearerToken (scheme is case-insensitive)', () => {
  it('takes any case of Bearer and extra spaces', () => {
    expect(bearerToken('Bearer tnt_scim_x')).toBe('tnt_scim_x');
    expect(bearerToken('bearer   tnt_scim_x ')).toBe('tnt_scim_x');
    expect(bearerToken('BEARER tnt_scim_x')).toBe('tnt_scim_x');
  });

  it('refuses another scheme or nothing', () => {
    expect(bearerToken('Basic dXNlcjpwYXNz')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken('Bearer')).toBeNull();
  });
});
