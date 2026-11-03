export interface Rgb {
  r: number;
  g: number;
  b: number;
}

// The Carbon tokens a tenant colour drives (applied by @tenantry/ui's applyBrand).
export interface BrandTokens {
  interactive: string;
  hover: string;
  active: string;
  focus: string;
  link: string;
}

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const WHITE = '#ffffff';
const MIN_CONTRAST = 4.5;

export function parseHex(hex: string): Rgb | null {
  const m = HEX.exec(hex);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbOf(hex: string): Rgb {
  const rgb = parseHex(hex);
  if (!rgb) throw new TypeError(`Not a #rrggbb colour: ${hex}`);
  return rgb;
}

const toHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

// WCAG 2.x relative luminance.
function luminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(rgbOf(a)), luminance(rgbOf(b))].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export function meetsContrast(hex: string, against = WHITE, min = MIN_CONTRAST): boolean {
  return contrastRatio(hex, against) >= min;
}

function toHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn
      ? ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
      : max === gn
        ? ((bn - rn) / d + 2) / 6
        : ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function fromHsl({ h, s, l }: { h: number; s: number; l: number }): Rgb {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return { r: channel(h + 1 / 3) * 255, g: channel(h) * 255, b: channel(h - 1 / 3) * 255 };
}

// Moves HSL lightness by `percent` points (negative darkens), clamped to 0–100.
export function adjustLightness(hex: string, percent: number): string {
  const hsl = toHsl(rgbOf(hex));
  return toHex(fromHsl({ ...hsl, l: Math.min(1, Math.max(0, hsl.l + percent / 100)) }));
}

// The nearest shade, in 1 % lightness steps, that reaches `min` contrast; the colour itself if it already does.
export function darkerUntilContrast(hex: string, against = WHITE, min = MIN_CONTRAST): string {
  let current = toHex(rgbOf(hex));
  for (let step = 0; step < 100 && !meetsContrast(current, against, min); step++) {
    current = adjustLightness(current, -1);
  }
  return current;
}

export function brandTokens(hex: string): BrandTokens {
  const interactive = toHex(rgbOf(hex));
  return {
    interactive,
    hover: adjustLightness(interactive, -8),
    active: adjustLightness(interactive, -16),
    focus: interactive,
    link: interactive,
  };
}
