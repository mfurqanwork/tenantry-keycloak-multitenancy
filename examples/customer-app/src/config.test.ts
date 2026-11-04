import { describe, expect, it } from 'vitest';
import { internalUrl, loadConfig } from './config.js';

const env = {
  ISSUER: 'http://auth.tenantry.localhost:8080/realms/ent-initech',
  CLIENT_ID: 'app-0a1b2c3d',
  CLIENT_SECRET: 's3cret',
  AUTH_INTERNAL_URL: 'http://127.0.0.1:8180',
};

describe('the example app settings', () => {
  it('reads the four settings the seed writes', () => {
    expect(loadConfig(env)).toEqual({
      issuer: env.ISSUER,
      clientId: 'app-0a1b2c3d',
      clientSecret: 's3cret',
      authInternalUrl: 'http://127.0.0.1:8180',
      port: 4000,
      baseUrl: 'http://127.0.0.1:4000',
    });
    expect(loadConfig({ ...env, AUTH_INTERNAL_URL: undefined }).authInternalUrl).toBeNull();
  });

  it('says where the settings come from when one is missing', () => {
    expect(() => loadConfig({ ...env, CLIENT_SECRET: undefined })).toThrow(
      'Set CLIENT_SECRET (pnpm seed writes examples/customer-app/.env).',
    );
    expect(() => loadConfig({ ...env, ISSUER: '' })).toThrow(
      'Set ISSUER (pnpm seed writes examples/customer-app/.env).',
    );
  });

  it("reaches Keycloak at the internal address, keeping the issuer's paths", () => {
    expect(
      internalUrl(`${env.ISSUER}/.well-known/openid-configuration`, env.ISSUER, env.AUTH_INTERNAL_URL),
    ).toBe('http://127.0.0.1:8180/realms/ent-initech/.well-known/openid-configuration');
    expect(internalUrl('https://elsewhere.test/x', env.ISSUER, env.AUTH_INTERNAL_URL)).toBe(
      'https://elsewhere.test/x',
    );
    expect(internalUrl(`${env.ISSUER}/x`, env.ISSUER, null)).toBe(`${env.ISSUER}/x`);
  });
});
