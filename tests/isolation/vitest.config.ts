import { defineConfig } from 'vitest/config';

// Runs against the whole running stack (pnpm dev:stack): Caddy, the API, Keycloak and Postgres.
// One file at a time: the files share that stack, and some change a realm's settings for a moment
// (Phase 5a sets Initech's two-step sign-in to required), which another file's sign-in would meet.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], testTimeout: 30000, hookTimeout: 60000, fileParallelism: false },
});
