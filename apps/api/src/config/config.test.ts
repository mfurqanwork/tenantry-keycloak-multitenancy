import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('fails on an empty environment', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });

  it('names every missing variable', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL.*TENANTRY_AUTH_URL|TENANTRY_AUTH_URL.*DATABASE_URL/);
  });

  it('fills defaults for the optional variables', () => {
    expect(
      loadConfig({ DATABASE_URL: 'postgres://x', TENANTRY_AUTH_URL: 'http://auth.tenantry.localhost' }),
    ).toEqual({
      port: 3000,
      databaseUrl: 'postgres://x',
      authUrl: 'http://auth.tenantry.localhost',
      authInternalUrl: 'http://auth.tenantry.localhost',
      platformRealm: 'platform',
      logLevel: 'info',
    });
  });

  it('reaches Keycloak through the internal URL when one is set', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://x',
      TENANTRY_AUTH_URL: 'http://auth.tenantry.localhost:8080',
      TENANTRY_AUTH_INTERNAL_URL: 'http://127.0.0.1:8180/',
    });
    expect(config.authUrl).toBe('http://auth.tenantry.localhost:8080');
    expect(config.authInternalUrl).toBe('http://127.0.0.1:8180');
  });

  it('defaults the internal URL to the public one', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://x',
      TENANTRY_AUTH_URL: 'http://auth.tenantry.localhost',
    });
    expect(config.authInternalUrl).toBe('http://auth.tenantry.localhost');
  });
});
