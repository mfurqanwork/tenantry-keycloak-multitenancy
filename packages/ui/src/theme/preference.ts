export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'tenantry.theme';

const VALUES: readonly ThemePreference[] = ['system', 'light', 'dark'];

// Storage can be missing or throw (private windows, blocked site data); the OS theme is the fallback.
export function readPreference(storage: Storage = globalThis.localStorage): ThemePreference {
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return VALUES.find((v) => v === value) ?? 'system';
  } catch {
    return 'system';
  }
}

export function writePreference(
  preference: ThemePreference,
  storage: Storage = globalThis.localStorage,
): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not saved; the choice still applies for this visit.
  }
}
