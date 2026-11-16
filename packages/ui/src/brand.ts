import type { BrandTokens } from '@tenantry/brand';

// The custom properties a workspace colour overrides, and the token each one takes: the new tokens
// (tokens.css), then Carbon's for the pages that still wear it until they move (ADR-0031).
const PROPERTIES: readonly [string, keyof BrandTokens][] = [
  ['--primary', 'interactive'],
  ['--primary-hover', 'hover'],
  ['--primary-active', 'active'],
  ['--primary-foreground', 'foreground'],
  ['--primary-subtle', 'subtle'],
  ['--ring', 'focus'],
  ['--link', 'link'],
  ['--cds-interactive', 'interactive'],
  ['--cds-button-primary', 'interactive'],
  ['--cds-button-primary-hover', 'hover'],
  ['--cds-button-primary-active', 'active'],
  ['--cds-link-primary', 'link'],
  ['--cds-focus', 'focus'],
  ['--cds-border-interactive', 'interactive'],
];

export const BRAND_PROPERTIES: readonly string[] = PROPERTIES.map(([name]) => name);

/**
 * Sets the workspace colour on the page (document.body by default), or on one element such as a preview;
 * null puts Tenantry's own look back. `data-brand` marks where a workspace colour applies, so Tenantry's
 * opal frame never mixes with it: on <html> for the page, on the element itself for a preview.
 */
export function applyBrand(tokens: BrandTokens | null, target: HTMLElement = document.body): void {
  for (const [name, key] of PROPERTIES) {
    if (tokens) target.style.setProperty(name, tokens[key]);
    else target.style.removeProperty(name);
  }
  const marked = target === document.body ? document.documentElement : target;
  if (tokens) marked.dataset['brand'] = 'workspace';
  else delete marked.dataset['brand'];
}
