import { ServiceUnavailableException } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { DatabaseHealthIndicator } from './db.health.js';
import { HealthController } from './health.controller.js';
import { KeycloakHealthIndicator } from './keycloak.health.js';

async function controllerWith(keycloakUp: boolean) {
  const moduleRef = await Test.createTestingModule({
    imports: [TerminusModule],
    controllers: [HealthController],
    providers: [
      {
        provide: DatabaseHealthIndicator,
        useValue: { check: () => Promise.resolve({ database: { status: 'up' } }) },
      },
      {
        provide: KeycloakHealthIndicator,
        useValue: {
          check: () =>
            Promise.resolve({ keycloak: { status: keycloakUp ? 'up' : 'down', message: 'fetch failed' } }),
        },
      },
    ],
  }).compile();
  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  it('reports ok when every check is up', async () => {
    const result = await (await controllerWith(true)).check();
    expect(result.status).toBe('ok');
  });

  it('answers 503 naming keycloak when it is down', async () => {
    const error: unknown = await (await controllerWith(false)).check().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      error: { keycloak: { status: 'down' } },
    });
  });
});
