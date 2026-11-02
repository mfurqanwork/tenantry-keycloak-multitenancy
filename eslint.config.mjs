import tseslint from 'typescript-eslint';

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
      // ADR-0016: only packages/db talks to Postgres directly.
      'no-restricted-imports': ['error', { paths: ['pg'], patterns: ['drizzle-orm/node-postgres*'] }],
    },
  },
  { files: ['packages/db/**'], rules: { 'no-restricted-imports': 'off' } },
);
