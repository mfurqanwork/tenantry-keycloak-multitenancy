import react from '@vitejs/plugin-react';
import { keycloakify } from 'keycloakify/vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    // One JAR for Keycloak 26 (ADR-0021); no account theme, Keycloak's own stays.
    keycloakify({
      themeName: 'tenantry',
      accountThemeImplementation: 'none',
      keycloakVersionTargets: { '22-to-25': false, 'all-other-versions': 'tenantry-login-theme.jar' },
    }),
  ],
  // Carbon's own Sass still uses deprecated syntax; keep our build output to our own warnings.
  css: { preprocessorOptions: { scss: { quietDeps: true } } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  },
});
