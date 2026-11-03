import { brandTokens } from '@tenantry/brand';
import { describe, expect, it } from 'vitest';
import { applyBrand, BRAND_PROPERTIES } from './brand.js';

describe('applyBrand', () => {
  it("sets Carbon's interactive tokens on the target", () => {
    const el = document.createElement('div');
    applyBrand(brandTokens('#0f62fe'), el);
    expect(el.style.getPropertyValue('--cds-button-primary')).toBe('#0f62fe');
    expect(el.style.getPropertyValue('--cds-interactive')).toBe('#0f62fe');
    expect(el.style.getPropertyValue('--cds-button-primary-hover')).toBe(brandTokens('#0f62fe').hover);
    expect(el.style.getPropertyValue('--cds-button-primary-active')).toBe(brandTokens('#0f62fe').active);
  });

  it('removes all seven properties for null', () => {
    const el = document.createElement('div');
    applyBrand(brandTokens('#0f62fe'), el);
    applyBrand(null, el);
    expect(BRAND_PROPERTIES).toHaveLength(7);
    for (const name of BRAND_PROPERTIES) expect(el.style.getPropertyValue(name)).toBe('');
  });

  it('writes on the page body by default and nowhere else', () => {
    const header = document.createElement('header');
    document.body.append(header);
    applyBrand(brandTokens('#198038'));
    expect(document.body.style.getPropertyValue('--cds-link-primary')).toBe('#198038');
    expect(header.style.getPropertyValue('--cds-link-primary')).toBe('');
    applyBrand(null);
    header.remove();
  });
});
