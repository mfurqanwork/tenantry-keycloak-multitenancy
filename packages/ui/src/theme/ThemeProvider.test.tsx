import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

describe('TenantryThemeProvider', () => {
  it('follows a dark operating system theme', () => {
    stubColorScheme(true);
    render(
      <TenantryThemeProvider>
        <Probe />
      </TenantryThemeProvider>,
    );
    expect(screen.getByTestId('resolved')).toHaveTextContent('g100');
  });

  it('lets the user override the system theme', () => {
    stubColorScheme(true);
    render(
      <TenantryThemeProvider>
        <Probe />
      </TenantryThemeProvider>,
    );
    act(() => {
      screen.getByRole('button', { name: 'light' }).click();
    });
    expect(screen.getByTestId('resolved')).toHaveTextContent('g10');
  });
});
