export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'tenantry.theme';

const VALUES: readonly ThemePreference[] = ['system', 'light', 'dark'];

// Storage can be missing or throw (private windows, blocked site data); then the fallback applies,
// the OS theme unless the page says otherwise.
export function readPreference(
  storage: Storage = globalThis.localStorage,
  fallback: ThemePreference = 'system',
): ThemePreference {
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return VALUES.find((v) => v === value) ?? fallback;
  } catch {
    return fallback;
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
