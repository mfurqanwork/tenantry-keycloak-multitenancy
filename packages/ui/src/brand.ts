import type { BrandTokens } from '@tenantry/brand';

// The Carbon custom properties a tenant colour overrides, and the token each one takes.
const PROPERTIES: readonly [string, keyof BrandTokens][] = [
  ['--cds-interactive', 'interactive'],
  ['--cds-button-primary', 'interactive'],
  ['--cds-button-primary-hover', 'hover'],
  ['--cds-button-primary-active', 'active'],
  ['--cds-link-primary', 'link'],
  ['--cds-focus', 'focus'],
  ['--cds-border-interactive', 'interactive'],
];

export const BRAND_PROPERTIES: readonly string[] = PROPERTIES.map(([name]) => name);

// Sets the tenant's colour on the page (document.body by default); null puts Carbon's back. The header
// sits in its own g100 Theme, which redefines these properties, so it keeps its colours.
export function applyBrand(tokens: BrandTokens | null, target: HTMLElement = document.body): void {
  for (const [name, key] of PROPERTIES) {
    if (tokens) target.style.setProperty(name, tokens[key]);
    else target.style.removeProperty(name);
  }
}
