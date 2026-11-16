import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as sass from 'sass';
import { describe, expect, it } from 'vitest';

// Carbon's CSS sits in a layer below Tailwind's components and utilities (ADR-0031): unlayered, its reset
// (`div, span, a, p, nav … { padding: 0; margin: 0; border: 0; font: inherit }`) beat every utility of the
// new shell in Admin. In a layer above Tailwind's base, Carbon's own components still beat the preflight.
// Vite resolves Carbon's bare imports through pnpm's nested installs; plain Sass needs this to do the same.
const pnpmImporter: sass.FileImporter<'sync'> = {
  findFileUrl(url, { containingUrl }) {
    if (url.startsWith('.') || url.includes(':') || !containingUrl) return null;
    let dir = realpathSync(dirname(fileURLToPath(containingUrl)));
    for (;;) {
      const candidate = join(dir, 'node_modules', url);
      if (existsSync(dirname(candidate))) return pathToFileURL(candidate);
      const parent = dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  },
};

describe('the legacy Carbon sheet', () => {
  const css = sass.compile(resolve(process.cwd(), 'src/styles/carbon-legacy.scss'), {
    importers: [pnpmImporter],
    quietDeps: true,
  }).css;

  it('puts every rule inside @layer carbon', () => {
    const body = css.replace(/^@charset[^;]*;\s*/, '').trim();
    expect(body.startsWith('@layer carbon {')).toBe(true);
    expect(body.endsWith('}')).toBe(true);
    expect(body.match(/@layer carbon \{/g)).toHaveLength(1);
  });

  it('Admin declares the layer order before anything else', () => {
    const portal = readFileSync(resolve(process.cwd(), '../../apps/portal/src/styles.css'), 'utf8');
    const statement = portal.indexOf('@layer theme, base, carbon, components, utilities;');
    expect(statement).toBeGreaterThan(-1);
    expect(statement).toBeLessThan(portal.indexOf('@import'));
  });
});
