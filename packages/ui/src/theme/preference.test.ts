import { describe, expect, it } from 'vitest';
import { readPreference, writePreference } from './preference.js';

const throwing = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
} as unknown as Storage;
describe('theme preference', () => {
  it('falls back to the system theme when storage is blocked', () => {
    expect(readPreference(throwing)).toBe('system');
  });

  it('does not throw when saving into blocked storage', () => {
    expect(() => {
      writePreference('dark', throwing);
    }).not.toThrow();
  });
});
