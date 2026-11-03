import { describe, expect, it } from 'vitest';
import {
  adjustLightness,
  brandTokens,
  contrastRatio,
  darkerUntilContrast,
  meetsContrast,
  parseHex,
} from './color.js';

describe('parseHex', () => {
  it('reads #rrggbb in either case', () => {
    expect(parseHex('#0F62FE')).toEqual({ r: 15, g: 98, b: 254 });
  });

  it('refuses anything else', () => {
    expect(parseHex('0f62fe')).toBeNull();
    expect(parseHex('#fff')).toBeNull();
    expect(parseHex('#0f62fg')).toBeNull();
  });
});

describe('contrast', () => {
  it('measures WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#0f62fe', '#ffffff')).toBeCloseTo(5.0, 1);
  });

  it('passes Carbon blue and fails yellow against white at 4.5:1', () => {
    expect(meetsContrast('#0f62fe')).toBe(true);
    expect(meetsContrast('#ffcc00')).toBe(false);
  });
});

describe('darkerUntilContrast', () => {
  it('returns the nearest darker shade that passes', () => {
    const suggestion = darkerUntilContrast('#ffcc00');
    expect(meetsContrast(suggestion)).toBe(true);
    expect(meetsContrast(adjustLightness(suggestion, 1))).toBe(false);
    expect(suggestion).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('leaves a passing colour alone', () => {
    expect(darkerUntilContrast('#0F62FE')).toBe('#0f62fe');
  });
});

describe('brandTokens', () => {
  it('uses the colour for interactive, focus and link, and darker shades for hover and active', () => {
    const tokens = brandTokens('#0f62fe');
    expect(tokens).toMatchObject({ interactive: '#0f62fe', focus: '#0f62fe', link: '#0f62fe' });
    expect(contrastRatio(tokens.hover, '#ffffff')).toBeGreaterThan(contrastRatio('#0f62fe', '#ffffff'));
    expect(contrastRatio(tokens.active, '#ffffff')).toBeGreaterThan(contrastRatio(tokens.hover, '#ffffff'));
  });
});
