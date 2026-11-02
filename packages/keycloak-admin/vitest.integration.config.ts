import { defineConfig } from 'vitest/config';

// Runs against the local Keycloak; part of pnpm test:isolation.
export default defineConfig({
  test: { include: ['test-integration/**/*.itest.ts'], testTimeout: 20000 },
});
