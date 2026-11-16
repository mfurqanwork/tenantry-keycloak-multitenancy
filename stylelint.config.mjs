// Tokens only (ADR-0031): colour, spacing, size, radius and shadow come from the token file
// (packages/ui/src/styles/tokens.css), or Carbon's tokens on the legacy pages, never raw values.
const TAILWIND_AT_RULES = ['theme', 'utility', 'custom-variant', 'variant', 'source', 'apply', 'reference', 'plugin', 'config'];

export default {
  extends: ['stylelint-config-standard-scss'],
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'declaration-property-unit-disallowed-list': {
      '/^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|width|height|inline-size|block-size|min-|max-|font-size|line-height)/':
        ['px', 'rem', 'em'],
    },
    'property-disallowed-list': ['box-shadow', 'border-radius'],
    'function-disallowed-list': ['linear-gradient', 'radial-gradient'],
    'selector-class-pattern': '^(tenantry|cds)-[a-z0-9-]+(__[a-z0-9-]+)?(--[a-z0-9-]+)?$',
    'scss/at-use-no-unnamespaced': null,
  },
  overrides: [
    {
      // Tailwind stylesheets: its at-rules, and its own class names (`.dark`, utilities).
      files: ['**/*.css'],
      rules: {
        'scss/at-rule-no-unknown': [true, { ignoreAtRules: TAILWIND_AT_RULES }],
        'at-rule-no-unknown': [true, { ignoreAtRules: TAILWIND_AT_RULES }],
        'import-notation': 'string',
        'selector-class-pattern': '^[a-z][a-z0-9-]*$',
        // `&` inside @utility is scoped by Tailwind.
        'nesting-selector-no-missing-scoping-root': null,
      },
    },
    {
      // The one place raw values live.
      files: ['**/styles/tokens.css'],
      rules: {
        'color-no-hex': null,
        'color-named': null,
        // Written in full, as the brand documents them.
        'color-hex-length': null,
        'declaration-property-unit-disallowed-list': null,
        'property-disallowed-list': null,
        'function-disallowed-list': null,
      },
    },
  ],
};
