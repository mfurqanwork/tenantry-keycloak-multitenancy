import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// Tenantry's own brand: SVGs written by `pnpm brand:icons` with the opal tile embedded, and PNG icons rendered
// from them (docs/brand.md).
const dir = new URL('../../packages/ui/assets/brand/', import.meta.url);
const SVGS = [
  'tenantry-mark.svg',
  'tenantry-mark-dark.svg',
  'tenantry-logo.svg',
  'tenantry-logo-dark.svg',
  'tenantry-logo-card.svg',
  'favicon.svg',
];
const PNGS = {
  'favicon-32.png': [32, 32],
  'apple-touch-icon.png': [180, 180],
  'icon-512.png': [512, 512],
  'social-preview.png': [1280, 640],
};
const NAVY = /#12224a/i;
const PALE = /#eef2ff/i;

// The opal tile is a small embedded PNG; the rest is a few shapes.
for (const name of SVGS) {
  test(`${name} is small, titled and scalable`, () => {
    const file = new URL(name, dir);
    assert.ok(existsSync(file), `${name} is missing`);
    const svg = readFileSync(file, 'utf8');
    assert.ok(Buffer.byteLength(svg) <= 24 * 1024, `${name} is ${Buffer.byteLength(svg)} bytes`);
    assert.match(svg, /<title[^>]*>[^<]+<\/title>/);
    assert.match(svg, /viewBox="0 0 \d+ \d+"/);
  });
}

for (const name of SVGS) {
  test(`${name} has exactly one opal tile`, () => {
    const svg = readFileSync(new URL(name, dir), 'utf8');
    assert.equal(svg.match(/href="data:image\/png;base64,/g)?.length, 1);
    assert.doesNotMatch(svg, /#0f62fe/i);
  });
}

for (const [name, [width, height]] of Object.entries(PNGS)) {
  test(`${name} is ${width}×${height}`, () => {
    const file = new URL(name, dir);
    assert.ok(existsSync(file), `${name} is missing`);
    const png = readFileSync(file);
    assert.equal(png.toString('ascii', 12, 16), 'IHDR');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [width, height]);
  });
}

// The header is dark: the dark mark's other tiles are pale, or they vanish into it.
test('the dark mark has pale tiles and the light mark navy ones', () => {
  const dark = readFileSync(new URL('tenantry-mark-dark.svg', dir), 'utf8');
  assert.match(dark, PALE);
  assert.doesNotMatch(dark, NAVY);
  const light = readFileSync(new URL('tenantry-mark.svg', dir), 'utf8');
  assert.match(light, NAVY);
  assert.doesNotMatch(light, PALE);
});

// The favicon follows the browser: navy tiles, pale in a dark scheme.
test('the favicon switches its tiles with the colour scheme', () => {
  const svg = readFileSync(new URL('favicon.svg', dir), 'utf8');
  assert.match(svg, /prefers-color-scheme:\s*dark/);
  assert.match(svg, NAVY);
  assert.match(svg, PALE);
});
