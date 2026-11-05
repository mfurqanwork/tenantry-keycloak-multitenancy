import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// Tenantry's own brand (Phase 6a): hand-written SVGs, and PNG icons rendered from them by `pnpm brand:icons`.
const dir = new URL('../../packages/ui/assets/brand/', import.meta.url);
const SVGS = [
  'tenantry-mark.svg',
  'tenantry-mark-dark.svg',
  'tenantry-logo.svg',
  'tenantry-logo-dark.svg',
  'favicon.svg',
];
const PNGS = {
  'favicon-32.png': [32, 32],
  'apple-touch-icon.png': [180, 180],
  'icon-512.png': [512, 512],
  'social-preview.png': [1280, 640],
};

for (const name of SVGS) {
  test(`${name} is small, titled and scalable`, () => {
    const file = new URL(name, dir);
    assert.ok(existsSync(file), `${name} is missing`);
    const svg = readFileSync(file, 'utf8');
    assert.ok(Buffer.byteLength(svg) <= 4096, `${name} is ${Buffer.byteLength(svg)} bytes`);
    assert.match(svg, /<title[^>]*>[^<]+<\/title>/);
    assert.match(svg, /viewBox="0 0 \d+ \d+"/);
  });
}

for (const name of ['tenantry-mark.svg', 'tenantry-mark-dark.svg', 'favicon.svg']) {
  test(`${name} has exactly one tile in Tenantry blue`, () => {
    const svg = readFileSync(new URL(name, dir), 'utf8');
    assert.equal(svg.match(/#0f62fe/gi)?.length, 1);
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

// The header is always dark (g100): its mark's other tiles are light, or they vanish into it.
test('the dark mark has light tiles', () => {
  const svg = readFileSync(new URL('tenantry-mark-dark.svg', dir), 'utf8');
  assert.match(svg, /#f4f4f4/i);
  assert.doesNotMatch(svg, /#161616/i);
});
