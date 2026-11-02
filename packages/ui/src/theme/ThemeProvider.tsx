import { GlobalTheme } from '@carbon/react';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readPreference, writePreference, type ThemePreference } from './preference.js';

export type CarbonTheme = 'g10' | 'g100';

interface ThemeState {
  preference: ThemePreference;
  resolved: CarbonTheme;
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

// Light (g10) or dark (g100), following the OS unless the user picked one.
export function TenantryThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setStored] = useState<ThemePreference>(() => readPreference());
  const systemDark = useSystemDark();
  const resolved: CarbonTheme =
    preference === 'dark' || (preference === 'system' && systemDark) ? 'g100' : 'g10';

  useEffect(() => {
    document.documentElement.dataset['carbonTheme'] = resolved;
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

  return (
    <ThemeContext.Provider value={value}>
      <GlobalTheme theme={resolved}>{children}</GlobalTheme>
    </ThemeContext.Provider>
  );
}

export function useThemePreference(): ThemeState {
  const state = useContext(ThemeContext);
  if (!state) throw new Error('useThemePreference must be used inside TenantryThemeProvider');
  return state;
}
