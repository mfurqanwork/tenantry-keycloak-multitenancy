// Writes Tenantry's brand SVGs from the opal mosaic, then renders the PNG icons and the GitHub social preview
// (docs/brand.md). Run after changing the mark or the mosaic: `pnpm brand:icons`. The SVGs and PNGs are committed.
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const dir = new URL('../packages/ui/assets/brand/', import.meta.url);
const write = (name, text) => {
  writeFileSync(new URL(name, dir), text);
  console.log(`${name} (${text.length} bytes)`);
};

// Pengopal's colours: navy ink on light grounds, its pale tint on dark ones.
const INK = '#12224a';
const PALE = '#eef2ff';
const WORD = "Geist, Inter, 'Segoe UI', system-ui, sans-serif";
// A square cut from Pengopal's opal mosaic (the texture pengopal.com paints its opal type with).
const opal = `data:image/png;base64,${readFileSync(new URL('opal-tile.png', dir)).toString('base64')}`;

// The T of five tiles. The tile where the bar meets the stem is opal; on light grounds the mosaic is
// deepened (as on pengopal.com) so it holds against white.
const TILES = [
  [0.5, 0.5],
  [22.5, 0.5],
  [11.5, 11.5],
  [11.5, 22.5],
];
const tile = ([x, y]) => `<rect x="${x}" y="${y}" width="9" height="9" rx="2"/>`;
function mark(ground, id) {
  const deepen =
    ground === 'light'
      ? `<filter id="${id}d" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="0.85"/><feFuncG type="linear" slope="0.85"/><feFuncB type="linear" slope="0.85"/></feComponentTransfer><feColorMatrix type="saturate" values="1.25"/></filter>`
      : '';
  return {
    defs: `<clipPath id="${id}"><rect x="11.5" y="0.5" width="9" height="9" rx="2"/></clipPath>${deepen}`,
    body: `<image href="${opal}" x="11.5" y="0.5" width="9" height="9" clip-path="url(#${id})"${deepen ? ` filter="url(#${id}d)"` : ''}/>`,
    tiles: TILES.map(tile).join(''),
  };
}

const svg = (w, h, inner, title = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"${title ? ' role="img" aria-labelledby="t"' : ''}>\n${title ? '  <title id="t">Tenantry</title>\n' : ''}${inner}\n</svg>\n`;

function markSvg(ground) {
  const m = mark(ground, 'o');
  return svg(
    32,
    32,
    `  <defs>${m.defs}</defs>\n  ${m.body}\n  <g fill="${ground === 'light' ? INK : PALE}">${m.tiles}</g>`,
  );
}

function logoInner(ground, id = 'o') {
  const m = mark(ground, id);
  const ink = ground === 'light' ? INK : PALE;
  return {
    defs: m.defs,
    body: `${m.body}\n  <g fill="${ink}">${m.tiles}<text x="42" y="24" font-family="${WORD}" font-size="24" font-weight="600" letter-spacing="-0.5">Tenantry</text></g>`,
  };
}
const logoSvg = (ground) => {
  const l = logoInner(ground);
  return svg(164, 32, `  <defs>${l.defs}</defs>\n  ${l.body}`);
};

write('tenantry-mark.svg', markSvg('light'));
write('tenantry-mark-dark.svg', markSvg('dark'));
write('tenantry-logo.svg', logoSvg('light'));
write('tenantry-logo-dark.svg', logoSvg('dark'));

// The dark logo on its own navy card: the README's, readable in GitHub's light and dark themes.
{
  const l = logoInner('dark');
  write(
    'tenantry-logo-card.svg',
    svg(
      212,
      64,
      `  <defs>${l.defs}</defs>\n  <rect width="212" height="64" rx="12" fill="${INK}"/>\n  <g transform="translate(24 16)">${l.body}</g>`,
    ),
  );
}

// The favicon follows the browser's scheme: navy tiles on light, pale on dark.
{
  const m = mark('dark', 'o');
  write(
    'favicon.svg',
    svg(
      32,
      32,
      `  <style>.n{fill:${INK}}@media (prefers-color-scheme:dark){.n{fill:${PALE}}}</style>\n  <defs>${m.defs}</defs>\n  ${m.body}\n  <g class="n">${m.tiles}</g>`,
    ),
  );
}

const read = (name) => readFileSync(new URL(name, dir), 'utf8');
function render(text, width, out) {
  // The PNG renderer has no Geist; Segoe UI is the nearest system face it can find.
  const png = new Resvg(text.replaceAll(WORD, 'Segoe UI'), {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: true },
  })
    .render()
    .asPng();
  writeFileSync(new URL(out, dir), png);
  console.log(`${out} (${png.length} bytes)`);
}

// Small icons: the light mark. App icons: the dark mark on a navy tile, so they read on any home screen.
render(read('tenantry-mark.svg'), 32, 'favicon-32.png');
const tileIcon = (() => {
  const m = mark('dark', 'o');
  return svg(
    40,
    40,
    `  <defs>${m.defs}</defs>\n  <rect width="40" height="40" rx="9" fill="${INK}"/>\n  <g transform="translate(4 4)">${m.body}<g fill="${PALE}">${m.tiles}</g></g>`,
    false,
  );
})();
render(tileIcon, 180, 'apple-touch-icon.png');
render(tileIcon, 512, 'icon-512.png');

// The logo centred on Pengopal's soft grey, with the tagline under it.
{
  const l = logoInner('light', 'p');
  const preview = svg(
    1280,
    640,
    `  <defs>${l.defs}</defs>\n  <rect width="1280" height="640" fill="#f5f6fa"/>\n  <g transform="translate(312 220) scale(4)">${l.body}</g>\n  <text x="640" y="440" text-anchor="middle" fill="#4a5a86" font-family="${WORD}" font-size="34">Multi-tenant sign-in, teams and branding for SaaS, built on Keycloak</text>`,
    false,
  );
  render(preview, 1280, 'social-preview.png');
}
