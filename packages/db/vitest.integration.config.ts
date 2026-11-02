import { defineConfig } from 'vitest/config';

// Runs against the compose Postgres (pnpm dev:infra or dev:stack); part of pnpm test:isolation.
export default defineConfig({
  test: {
    include: ['test-integration/**/*.itest.ts'],
    globalSetup: ['test-integration/global-setup.ts'],
    fileParallelism: false,
  },
});
