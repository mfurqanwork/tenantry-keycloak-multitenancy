import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

const base = {
  DATABASE_URL: 'postgres://x',
  TENANTRY_AUTH_URL: 'http://auth.tenantry.localhost',
  KEYCLOAK_BACKEND_CLIENT_ID: 'tenantry-backend',
  KEYCLOAK_BACKEND_CLIENT_SECRET: 'secret',
};

describe('loadConfig', () => {
  it('fails on an empty environment', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });

  it('names every missing variable', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL.*TENANTRY_AUTH_URL|TENANTRY_AUTH_URL.*DATABASE_URL/);
  });

  it('fills defaults for the optional variables', () => {
    expect(loadConfig(base)).toEqual({
      port: 3000,
      databaseUrl: 'postgres://x',
      authUrl: 'http://auth.tenantry.localhost',
      authInternalUrl: 'http://auth.tenantry.localhost',
      platformRealm: 'platform',
      logLevel: 'info',
      baseDomain: 'tenantry.localhost',
      publicPort: null,
      backendClientId: 'tenantry-backend',
      backendClientSecret: 'secret',
    });
  });

  it('takes the public port from the auth URL', () => {
    expect(loadConfig({ ...base, TENANTRY_AUTH_URL: 'http://auth.tenantry.localhost:8080' }).publicPort).toBe(
      8080,
    );
  });

  it('names a missing backend secret', () => {
    const { KEYCLOAK_BACKEND_CLIENT_SECRET: _omit, ...env } = base;
    expect(() => loadConfig(env)).toThrow(/KEYCLOAK_BACKEND_CLIENT_SECRET/);
  });

  it('reads the base domain', () => {
    expect(loadConfig({ ...base, TENANTRY_BASE_DOMAIN: 'example.test' }).baseDomain).toBe('example.test');
  });

  it('reaches Keycloak through the internal URL when one is set', () => {
    const config = loadConfig({
      ...base,
      TENANTRY_AUTH_URL: 'http://auth.tenantry.localhost:8080',
      TENANTRY_AUTH_INTERNAL_URL: 'http://127.0.0.1:8180/',
    });
    expect(config.authUrl).toBe('http://auth.tenantry.localhost:8080');
    expect(config.authInternalUrl).toBe('http://127.0.0.1:8180');
  });

  it('defaults the internal URL to the public one', () => {
    const config = loadConfig(base);
    expect(config.authInternalUrl).toBe('http://auth.tenantry.localhost');
  });
});
