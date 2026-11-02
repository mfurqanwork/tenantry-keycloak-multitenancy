import { defineConfig } from 'vitest/config';

// Runs against the whole running stack (pnpm dev:stack): Caddy, the API, Keycloak and Postgres.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], testTimeout: 30000, hookTimeout: 60000 },
});
