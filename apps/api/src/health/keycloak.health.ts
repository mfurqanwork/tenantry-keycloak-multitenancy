import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { APP_CONFIG, type AppConfig } from '../config/config.js';

// Up only when the platform realm answers with the public issuer: a mismatch would break every token check.
@Injectable()
export class KeycloakHealthIndicator {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly health: HealthIndicatorService,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    const indicator = this.health.check('keycloak');
    const expected = `${this.config.authUrl}/realms/${this.config.platformRealm}`;
    try {
      const res = await fetch(`${expected}/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return indicator.down({ message: `discovery returned ${res.status}` });
      const { issuer } = (await res.json()) as { issuer?: string };
      if (issuer !== expected) {
        return indicator.down({ message: `issuer mismatch: got ${String(issuer)}, expected ${expected}` });
      }
      return indicator.up();
    } catch (err) {
      return indicator.down({ message: err instanceof Error ? err.message : String(err) });
    }
  }
}
