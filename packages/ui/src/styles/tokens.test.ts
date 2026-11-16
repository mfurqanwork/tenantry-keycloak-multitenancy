/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio } from '@tenantry/brand';
import { describe, expect, it } from 'vitest';

// Read from disk: Vitest empties stylesheets it imports. Tests run from the package folder.
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

/** The `--name: #hex` declarations of the first block whose selector is exactly `selector`. */
type Theme = (name: string) => string;

function block(selector: string): Theme {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`no ${selector} block in tokens.css`);
  const vars: Record<string, string> = {};
  for (const [, name = '', value = ''] of (match[1] ?? '').matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    vars[name] = value.toLowerCase();
  }
  return (name) => {
    const value = vars[name];
    if (!value) throw new Error(`no --${name} in ${selector}`);
    return value;
  };
}

const light = block(':root');
const dark = block('.dark');

describe('tokens', () => {
  it('light theme is navy ink on white', () => {
    expect(light('foreground')).toBe('#12224a');
    expect(light('background')).toBe('#ffffff');
  });

  it('dark theme is the navy ground, panels and pale text', () => {
    expect(dark('background')).toBe('#0e1a3a');
    expect(dark('card')).toBe('#13224a');
    expect(dark('foreground')).toBe('#eef2ff');
  });

  it('links are opal blue', () => {
    expect(light('link')).toBe('#2b77c0');
  });

  it.each([
    ['light', light],
    ['dark', dark],
  ])('%s text reads at 4.5:1 or more', (_name, theme) => {
    expect(contrastRatio(theme('foreground'), theme('background'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme('muted-foreground'), theme('background'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme('muted-foreground'), theme('muted'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme('link'), theme('background'))).toBeGreaterThanOrEqual(4.5);
  });

  it('the opal frame applies only without a workspace colour', () => {
    const frame = /@utility opal-frame\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(frame).toContain(':not([data-brand])');
  });
});
