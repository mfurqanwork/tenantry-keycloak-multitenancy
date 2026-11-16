import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readPreference, writePreference, type ThemePreference } from './preference.js';

export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const DARK_QUERY = '(prefers-color-scheme: dark)';

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setDark(event.matches);
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);
  return dark;
}

// Light or dark, following the OS unless the person picked one. The `dark` class on <html> drives the tokens.
export function TenantryThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setStored] = useState<ThemePreference>(() => readPreference());
  const systemDark = useSystemDark();
  const resolved: ResolvedTheme =
    preference === 'dark' || (preference === 'system' && systemDark) ? 'dark' : 'light';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
  }, [resolved]);

  const value = useMemo<ThemeState>(
    () => ({
      preference,
      resolved,
      setPreference: (next) => {
        writePreference(next);
        setStored(next);
      },
    }),
    [preference, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference(): ThemeState {
  const state = useContext(ThemeContext);
  if (!state) throw new Error('useThemePreference must be used inside TenantryThemeProvider');
  return state;
}
