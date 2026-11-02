import { describe, expect, it } from 'vitest';
import { readPreference, THEME_STORAGE_KEY, writePreference } from './preference.js';

const throwing = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
} as unknown as Storage;
const storageWith = (key: string, value: string) =>
  ({ getItem: (k: string) => (k === key ? value : null) }) as unknown as Storage;

describe('theme preference', () => {
  it('falls back to the system theme when storage is blocked', () => {
    expect(readPreference(throwing)).toBe('system');
  });

  it('does not throw when saving into blocked storage', () => {
    expect(() => {
      writePreference('dark', throwing);
    }).not.toThrow();
  });

  it('ignores an unknown stored value', () => {
    expect(readPreference(storageWith(THEME_STORAGE_KEY, 'bogus'))).toBe('system');
  });

  it('round-trips a saved choice', () => {
    writePreference('dark', localStorage);
    expect(readPreference(localStorage)).toBe('dark');
  });
});
