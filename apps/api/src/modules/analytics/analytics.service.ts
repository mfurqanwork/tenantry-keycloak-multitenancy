import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';

export type EventProps = Record<string, string | number | boolean | null>;

// Changes made by the operator scripts (no user) are counted under one anonymous id.
export const OPERATOR_DISTINCT_ID = 'tenantry-ops';

// Pengopal's sites share one PostHog project; every event says which product it came from.
export const PRODUCT = 'tenantry';

// Product events sent to PostHog from the server, so counts do not depend on ad blockers.
// No key (local, tests): every call does nothing. Sending never blocks or fails a request.
// Events carry ids and small labels only: never emails, names or tokens.
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  capture(event: string, userId: string | null, props: EventProps = {}): void {
    const { key, host } = this.config.posthog;
    if (!key) return;
    const body = JSON.stringify({
      api_key: key,
      event,
      distinct_id: userId ?? OPERATOR_DISTINCT_ID,
      timestamp: new Date().toISOString(),
      properties: {
        ...props,
        product: PRODUCT,
        $lib: 'tenantry-api',
        ...(userId ? {} : { $process_person_profile: false }),
      },
    });
    fetch(`${host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(5000),
    }).then(
      (res) => {
        if (!res.ok) this.logger.warn({ status: res.status }, 'PostHog refused an event');
      },
      (err: unknown) => {
        this.logger.warn({ err }, 'PostHog unreachable');
      },
    );
  }
}
