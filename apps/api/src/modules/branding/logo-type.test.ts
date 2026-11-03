import { describe, expect, it } from 'vitest';
import { sniffImageType } from './logo-type.js';

const bytes = (...b: number[]) => Buffer.from(b);

describe('sniffImageType', () => {
  it('recognises PNG, JPEG and WebP by their first bytes', () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png');
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0))).toBe('image/jpeg');
    expect(
      sniffImageType(Buffer.concat([Buffer.from('RIFF'), bytes(1, 2, 3, 4), Buffer.from('WEBPVP8 ')])),
    ).toBe('image/webp');
  });

  it('refuses SVG, HTML and anything too short to tell', () => {
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(Buffer.from('<!doctype html><script>alert(1)</script>'))).toBeNull();
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e))).toBeNull();
    expect(
      sniffImageType(Buffer.concat([Buffer.from('RIFF'), bytes(1, 2, 3, 4), Buffer.from('WAVE')])),
    ).toBeNull();
  });
});
