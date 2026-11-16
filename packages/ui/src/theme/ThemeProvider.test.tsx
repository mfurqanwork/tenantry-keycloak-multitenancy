import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { stubColorScheme } from '../test/setup.js';
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

});
