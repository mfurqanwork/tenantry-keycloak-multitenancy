import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';

// Product analytics (PostHog): server events from the audit log, and the browser relay in http-setup.ts.
@Module({
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
