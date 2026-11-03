import tseslint from 'typescript-eslint';

// Who may import what (AGENTS.md hard rules). Each area gets the full list minus what it owns.
const PG = { paths: ['pg'], patterns: ['drizzle-orm/node-postgres*'] }; // ADR-0016: only packages/db
const OIDC = { name: 'oidc-client-ts', message: 'Sign in through @tenantry/oidc-client.' };
const KEYCLOAK_HTTP = {
  name: '@tenantry/keycloak-admin',
  importNames: ['createHttpIdentityDirectory'],
  message: 'Inject IDENTITY_DIRECTORY; only apps/api/src/infrastructure builds the HTTP client.',
};
// ADR-0017: a feature module reaches another only through its exported service or its module.
const MODULE_INTERNALS = {
  group: ['../*/*', '!../../**', '!../*/*.service.js', '!../*/*.module.js'],
  message: "Import another module's service (or module), not its internals.",
};

const restrict = ({ pg = true, oidc = true, keycloak = true, modules = false }) => [
  'error',
  {
    paths: [...(pg ? PG.paths : []), ...(oidc ? [OIDC] : []), ...(keycloak ? [KEYCLOAK_HTTP] : [])],
    patterns: [
      ...(pg ? PG.patterns.map((p) => ({ group: [p] })) : []),
      ...(modules ? [MODULE_INTERNALS] : []),
    ],
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.config.*',
      'scripts/**',
    ],
  },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': restrict({}),
    },
  },
  { files: ['packages/db/**'], rules: { 'no-restricted-imports': restrict({ pg: false }) } },
  { files: ['packages/oidc-client/**'], rules: { 'no-restricted-imports': restrict({ oidc: false }) } },
  {
    // The two places that build the Keycloak HTTP client: the API's wiring and the operator CLI's.
    files: ['apps/api/src/infrastructure/**', 'apps/ops/src/cli.ts'],
    rules: { 'no-restricted-imports': restrict({ keycloak: false }) },
  },
  { files: ['apps/api/src/modules/**'], rules: { 'no-restricted-imports': restrict({ modules: true }) } },
);
