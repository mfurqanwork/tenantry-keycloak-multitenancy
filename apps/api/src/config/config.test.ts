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

  it('reaches Keycloak through the internal URL when one is set', () => {
    const config = loadConfig({
      ...base,
      TENANTRY_AUTH_URL: 'http://auth.tenantry.localhost:8080',
      TENANTRY_AUTH_INTERNAL_URL: 'http://127.0.0.1:8180/',
    });
    expect(config.authUrl).toBe('http://auth.tenantry.localhost:8080');
    expect(config.authInternalUrl).toBe('http://127.0.0.1:8180');
  });
});
