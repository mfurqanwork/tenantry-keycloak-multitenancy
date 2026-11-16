import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubColorScheme } from '../test/setup.js';
import { writePreference } from './preference.js';
import { TenantryThemeProvider, useThemePreference } from './ThemeProvider.js';

function Probe() {
  const { resolved, setPreference } = useThemePreference();
  return (
    <>
      <span data-testid="resolved">{resolved}</span>
      <button
        onClick={() => {
          setPreference('light');
        }}
      >
        light
      </button>
    </>
  );
}

function renderProvider() {
  return render(
    <TenantryThemeProvider>
      <Probe />
    </TenantryThemeProvider>,
  );
}

/** A matchMedia whose dark-scheme answer can change, telling its listeners. */
function liveColorScheme(dark: boolean): (next: boolean) => void {
  let matches = dark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('dark') ? matches : false;
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
  return (next) => {
    matches = next;
    for (const listener of listeners) listener({ matches: next } as MediaQueryListEvent);
  };
}

afterEach(() => {
  document.documentElement.classList.remove('dark');
  stubColorScheme(false);
});

describe('TenantryThemeProvider', () => {
  it('follows a dark operating system theme', () => {
    stubColorScheme(true);
    renderProvider();
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
  });

  it('lets the user override the system theme', () => {
    stubColorScheme(true);
    renderProvider();
    act(() => {
      screen.getByRole('button', { name: 'light' }).click();
    });
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('dark preference puts class dark on <html>', () => {
    writePreference('dark');
    renderProvider();
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveAttribute('data-carbon-theme');
  });

  it('system follows prefers-color-scheme', () => {
    const setDark = liveColorScheme(true);
    renderProvider();
    expect(document.documentElement).toHaveClass('dark');
    act(() => {
      setDark(false);
    });
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement).not.toHaveAttribute('data-carbon-theme');
  });
});
