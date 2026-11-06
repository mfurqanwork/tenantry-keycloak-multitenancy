import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const root = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'TENANTRY_');
  return {
    plugins: [react()],
    // VITE_ variables (the welcome page's demo workspaces) come from the repository's .env, like the rest.
    envDir: root,
    // Carbon's own Sass still uses deprecated syntax; keep our build output to our own warnings.
    css: { preprocessorOptions: { scss: { quietDeps: true } } },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: ['.tenantry.localhost'],
      // The browser talks to Vite through Caddy, so hot reload must use Caddy's port.
      hmr: { clientPort: Number(env['TENANTRY_HTTP_PORT'] ?? 80) },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
      css: false,
      // jsdom and Carbon render slowly on CI runners; a form test can pass 5 s there.
      testTimeout: 15000,
    },
  };
});
