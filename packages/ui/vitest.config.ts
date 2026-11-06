import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // jsdom and Carbon render slowly under a full parallel run, like the apps' (15 s there too).
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'], testTimeout: 15000 },
});
