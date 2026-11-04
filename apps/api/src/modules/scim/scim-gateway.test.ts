import { describe, expect, it } from 'vitest';
import { bearerToken, isDeactivation, parseScimPath, rewriteLocation } from './scim-gateway.service.js';

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

describe('parseScimPath', () => {
  it('takes the SCIM resources, decoded once', () => {
    expect(parseScimPath('Users')).toEqual(['Users']);
    expect(parseScimPath('Users/ab%2Dcd')).toEqual(['Users', 'ab-cd']);
    expect(parseScimPath('Schemas/urn:ietf:params:scim:schemas:core:2.0:User')).toHaveLength(2);
    expect(parseScimPath('ServiceProviderConfig')).toEqual(['ServiceProviderConfig']);
  });

  it('refuses dot segments, literal or encoded', () => {
    expect(parseScimPath('../../admin/realms/x/users')).toBeNull();
    expect(parseScimPath('%2e%2e/%2e%2e/admin/realms/x/users')).toBeNull();
    expect(parseScimPath('Users/%2E%2E')).toBeNull();
    expect(parseScimPath('Users/.')).toBeNull();
  });

  it('refuses slashes, backslashes and double encoding inside a segment', () => {
    expect(parseScimPath('Users/a%2Fb')).toBeNull();
    expect(parseScimPath('Users/a%5Cb')).toBeNull();
    expect(parseScimPath('Users/%252e%252e')).toBeNull();
    expect(parseScimPath('Users/%zz')).toBeNull();
  });

  it('refuses anything but the SCIM resources, and deeper paths', () => {
    expect(parseScimPath('')).toBeNull();
    expect(parseScimPath('Bulk')).toBeNull();
    expect(parseScimPath('admin')).toBeNull();
    expect(parseScimPath('Users/a/b')).toBeNull();
    expect(parseScimPath('Users//')).toBeNull();
  });
});
