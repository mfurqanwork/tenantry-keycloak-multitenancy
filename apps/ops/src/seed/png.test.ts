import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { solidPng } from './png.js';

describe('solidPng', () => {
  it('makes a square PNG of one colour', () => {
    const png = solidPng('#0f62fe', 4);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(4);
    expect(png.readUInt32BE(20)).toBe(4);
    const idat = png.indexOf('IDAT');
    const pixels = inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)));
    // Each row: a filter byte, then RGB for every pixel.
    expect([...pixels.subarray(0, 4)]).toEqual([0, 0x0f, 0x62, 0xfe]);
    expect(pixels.length).toBe(4 * (1 + 4 * 3));
  });
});
