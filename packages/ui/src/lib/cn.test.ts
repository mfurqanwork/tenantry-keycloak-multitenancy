import { describe, expect, it } from 'vitest';
import { cn } from './cn.js';

describe('cn', () => {
  it('lets the later Tailwind class win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('drops falsy values', () => {
    const off = false as boolean;
    expect(cn('a', off && 'b')).toBe('a');
  });
});
