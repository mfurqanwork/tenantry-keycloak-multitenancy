import { HealthIndicatorService } from '@nestjs/terminus';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config/config.js';
import { KeycloakHealthIndicator } from './keycloak.health.js';

const config: AppConfig = {
  version: 'dev',
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
  provisionerClientId: 'p',
  provisionerClientSecret: 'p',
  secretsDir: '.secrets',
  smtp: { host: 'mailpit', port: '1025', from: 'x@example.com' },
  maxAppsPerTenant: 20,
};
const indicator = () => new KeycloakHealthIndicator(config, new HealthIndicatorService());
const respond = (status: number, body: unknown) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('KeycloakHealthIndicator', () => {
  it('is up when the discovery doc has the expected issuer', async () => {
    respond(200, { issuer: 'http://auth.tenantry.localhost/realms/platform' });
    await expect(indicator().check()).resolves.toEqual({ keycloak: { status: 'up' } });
  });

  it('is down on an issuer mismatch', async () => {
    respond(200, { issuer: 'http://localhost:8080/realms/platform' });
    await expect(indicator().check()).resolves.toEqual({
      keycloak: { status: 'down', message: expect.stringMatching(/issuer mismatch/) as string },
    });
  });

  it('is down, not crashing, while Keycloak is still starting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(indicator().check()).resolves.toEqual({
      keycloak: { status: 'down', message: 'fetch failed' },
    });
  });

  it('fetches through the internal URL but still expects the public issuer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ issuer: 'http://auth.tenantry.localhost/realms/platform' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const internal = new KeycloakHealthIndicator(
      { ...config, authInternalUrl: 'http://127.0.0.1:8180' },
      new HealthIndicatorService(),
    );
    await expect(internal.check()).resolves.toEqual({ keycloak: { status: 'up' } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:8180/realms/platform/.well-known/openid-configuration',
    );
  });
});
