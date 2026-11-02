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
      platformRealm: 'platform',
      logLevel: 'info',
    });
  });
});
