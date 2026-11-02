import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// API tests that need Postgres; part of pnpm test:isolation.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.itest.ts'],
    globalSetup: ['src/testing/global-setup.ts'],
    testTimeout: 15000,
  },
});
