import { brandTokens } from '@tenantry/brand';
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

  it('removes every property and the mark for null', () => {
    applyBrand(brandTokens('#0f62fe'));
    applyBrand(null);
    expect(BRAND_PROPERTIES).toContain('--primary');
    for (const name of BRAND_PROPERTIES) expect(document.body.style.getPropertyValue(name)).toBe('');
    expect(document.documentElement.dataset['brand']).toBeUndefined();
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
