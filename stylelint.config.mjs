// Tokens only (ADR-0031): colour, spacing, size, radius and shadow come from the token file
// (packages/ui/src/styles/tokens.css), never raw values.
const TAILWIND_AT_RULES = ['theme', 'utility', 'custom-variant', 'variant', 'source', 'apply', 'reference', 'plugin', 'config'];

export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'declaration-property-unit-disallowed-list': {
      '/^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|width|height|inline-size|block-size|min-|max-|font-size|line-height)/':
        ['px', 'rem', 'em'],
    },
    'property-disallowed-list': ['box-shadow', 'border-radius'],
    'function-disallowed-list': ['linear-gradient', 'radial-gradient'],
    // Tailwind's at-rules, and its own class names (`.dark`, utilities).
    'at-rule-no-unknown': [true, { ignoreAtRules: TAILWIND_AT_RULES }],
    // Tailwind's @apply and @utility take class names, which plain CSS cannot validate.
    'at-rule-prelude-no-invalid': null,
    'import-notation': 'string',
    'selector-class-pattern': '^[a-z][a-z0-9-]*$',
    // `&` inside @utility is scoped by Tailwind.
    'nesting-selector-no-missing-scoping-root': null,
  },
  overrides: [
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
