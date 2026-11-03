import { defineConfig } from 'vitest/config';

// Operator commands against the compose Postgres, with the in-memory Keycloak; part of pnpm test:isolation.
export default defineConfig({
  test: {
    include: ['src/**/*.itest.ts'],
    globalSetup: ['src/testing/global-setup.ts'],
    testTimeout: 15000,
    // The files share one database and count its tenants; run them one after another.
    fileParallelism: false,
  },
});
