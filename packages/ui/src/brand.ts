import type { BrandTokens } from '@tenantry/brand';

// The custom properties a workspace colour overrides, and the token each one takes (tokens.css). The subtle tint,
// links and the focus ring are not here: tokens.css derives them from the workspace colour for the current
// theme, since one inline value cannot be readable on both a light and a dark background.
const PROPERTIES: readonly [string, keyof BrandTokens][] = [
  ['--primary', 'interactive'],
  ['--primary-hover', 'hover'],
  ['--primary-active', 'active'],
  ['--primary-foreground', 'foreground'],
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
