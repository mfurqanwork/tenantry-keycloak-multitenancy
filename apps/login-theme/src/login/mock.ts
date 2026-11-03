import { createGetKcContextMock } from 'keycloakify/login/KcContext';
import { themeNames } from '../kc.gen.js';

// Keycloak contexts for tests, as Keycloak would render them for this theme.
export const { getKcContextMock } = createGetKcContextMock({
  kcContextExtension: { themeName: themeNames[0] ?? 'tenantry', properties: {} },
  kcContextExtensionPerPage: {},
  overrides: {},
  overridesPerPage: {},
});
