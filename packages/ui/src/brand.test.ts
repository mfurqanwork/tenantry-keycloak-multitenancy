import { brandTokens } from '@tenantry/brand';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyBrand, BRAND_PROPERTIES } from './brand.js';

afterEach(() => {
  applyBrand(null);
  document.documentElement.classList.remove('dark');
});

describe('applyBrand', () => {
  it('writes the workspace colour into the primary tokens on the page', () => {
    const tokens = brandTokens('#2b77c0');
    applyBrand(tokens);
    const body = document.body.style;
    expect(body.getPropertyValue('--primary')).toBe(tokens.interactive);
    expect(body.getPropertyValue('--primary-hover')).toBe(tokens.hover);
    expect(body.getPropertyValue('--primary-active')).toBe(tokens.active);
    expect(body.getPropertyValue('--primary-foreground')).toBe(tokens.foreground);
  });

  it('marks the page as wearing a workspace colour, so the opal frame steps aside', () => {
    applyBrand(brandTokens('#2b77c0'));
    expect(document.documentElement.dataset['brand']).toBe('workspace');
  });

  it('writes no Carbon tokens', () => {
    applyBrand(brandTokens('#0f62fe'));
    expect(BRAND_PROPERTIES.filter((name) => name.startsWith('--cds-'))).toEqual([]);
    expect(document.body.getAttribute('style')).not.toContain('--cds-');
    const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    expect(css).not.toContain('--cds-');
  });

  it('removes every property and the mark for null', () => {
    applyBrand(brandTokens('#0f62fe'));
    applyBrand(null);
    expect(BRAND_PROPERTIES).toContain('--primary');
    for (const name of BRAND_PROPERTIES) expect(document.body.style.getPropertyValue(name)).toBe('');
    expect(document.documentElement.dataset['brand']).toBeUndefined();
  });

  it('switching theme keeps the workspace colour and the mark', () => {
    applyBrand(brandTokens('#2b77c0'));
    document.documentElement.classList.add('dark');
    expect(document.body.style.getPropertyValue('--primary')).toBe('#2b77c0');
    expect(document.documentElement.dataset['brand']).toBe('workspace');
  });

  it('leaves the subtle tint to the theme, so dark mode keeps a dark tint of the workspace colour', () => {
    applyBrand(brandTokens('#2b77c0'));
    expect(document.body.style.getPropertyValue('--primary-subtle')).toBe('');
    const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    expect(css).toMatch(
      /\[data-brand\][^{]*>\s*body[^{]*\{\s*--primary-subtle:\s*color-mix\(in oklab, var\(--primary\) \d+%, var\(--background\)\);/,
    );
  });

  it('leaves links and the focus ring to the theme, lighter in dark mode so they stay readable', () => {
    applyBrand(brandTokens('#0f62fe'));
    for (const name of ['--link', '--ring']) {
      expect(document.body.style.getPropertyValue(name)).toBe('');
    }
    const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    expect(css).toMatch(/\[data-brand\] > body,\s*\[data-brand\]:not\(html\) \{[^}]*--link: var\(--primary\);[^}]*--ring: var\(--primary\);/);
    expect(css).toMatch(
      /\.dark\[data-brand\] > body,\s*\.dark \[data-brand\]:not\(html\) \{[^}]*--link: color-mix\(in oklab, var\(--primary\) \d+%, white\);/,
    );
  });

  it('a preview element gets the colour and its own mark, leaving the page alone', () => {
    const preview = document.createElement('div');
    document.body.append(preview);
    applyBrand(brandTokens('#198038'), preview);
    expect(preview.style.getPropertyValue('--primary')).toBe('#198038');
    expect(preview.dataset['brand']).toBe('workspace');
    expect(document.body.style.getPropertyValue('--primary')).toBe('');
    expect(document.documentElement.dataset['brand']).toBeUndefined();
    applyBrand(null, preview);
    expect(preview.dataset['brand']).toBeUndefined();
    preview.remove();
  });
});
