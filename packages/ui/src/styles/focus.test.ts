import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : [];
  });
}

// A focus indicator needs 3:1 against what is around it; the half-opacity ring was about 2:1 on white.
describe('the focus ring', () => {
  const ui = resolve(process.cwd(), 'src');
  const appKit = resolve(process.cwd(), '../app-kit/src');

  it('is solid, two pixels wide and set off from the control', () => {
    const css = readFileSync(join(ui, 'styles/index.css'), 'utf8');
    const utility = /@utility focus-ring \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(utility).toContain('focus-visible:ring-2');
    expect(utility).toContain('focus-visible:ring-ring');
    expect(utility).toContain('focus-visible:ring-offset-2');
    expect(utility).not.toMatch(/ring-ring\/\d+/);
  });

  it('no component uses a see-through ring', () => {
    const faint = [...sources(ui), ...sources(appKit)].filter((file) =>
      /ring-ring\/\d+/.test(readFileSync(file, 'utf8')),
    );
    expect(faint).toEqual([]);
  });
});
