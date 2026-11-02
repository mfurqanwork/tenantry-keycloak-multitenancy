import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { pingDatabase } from '@tenantry/db';
import type { Pool } from '@tenantry/db';

export const DB_POOL = Symbol('DB_POOL');

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly health: HealthIndicatorService,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    const indicator = this.health.check('database');
    try {
      await pingDatabase(this.pool);
      return indicator.up();
    } catch (err) {
      return indicator.down({ message: err instanceof Error ? err.message : String(err) });
    }
  }
}
