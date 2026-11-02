// Carbon tokens only: spacing and sizes come from $spacing-* and type styles, never raw px or rem.
export default {
  extends: ['stylelint-config-standard-scss'],
  rules: {
    'declaration-property-unit-disallowed-list': {
      '/^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|width|height|inline-size|block-size|min-|max-|font-size|line-height)/':
        ['px', 'rem', 'em'],
    },
    'property-disallowed-list': ['box-shadow', 'border-radius'],
    'function-disallowed-list': ['linear-gradient', 'radial-gradient'],
    'selector-class-pattern': '^(tenantry|cds)-[a-z0-9-]+(__[a-z0-9-]+)?(--[a-z0-9-]+)?$',
    'scss/at-use-no-unnamespaced': null,
  },
};
