// Renders Tenantry's PNG icons and GitHub social preview from the hand-written SVGs (docs/brand.md).
// Run after changing an SVG: `pnpm brand:icons`. The PNGs are committed.
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const dir = new URL('../packages/ui/assets/brand/', import.meta.url);
const read = (name) => readFileSync(new URL(name, dir), 'utf8');

function render(svg, width, out) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } })
    .render()
    .asPng();
  writeFileSync(new URL(out, dir), png);
  console.log(`${out} (${png.length} bytes)`);
}

// The favicon without its dark-scheme rule, so the tiles keep their light colours in a PNG.
const mark = read('tenantry-mark.svg');
render(mark, 32, 'favicon-32.png');
render(mark, 180, 'apple-touch-icon.png');
render(mark, 512, 'icon-512.png');

// The logo centred on Gray 10, with the tagline under it.
const logo = read('tenantry-logo.svg')
  .replace(/^<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<title[^>]*>[^<]*<\/title>/, '');
const preview = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" width="1280" height="640">
  <rect width="1280" height="640" fill="#f4f4f4"/>
  <g transform="translate(304 220) scale(4)">${logo}</g>
  <text x="640" y="440" text-anchor="middle" fill="#525252" font-family="'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif" font-size="36">Multi-tenant sign-in, teams and branding for SaaS, built on Keycloak</text>
</svg>`;
render(preview, 1280, 'social-preview.png');
