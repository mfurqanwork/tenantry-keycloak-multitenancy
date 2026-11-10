import { render, screen } from '@testing-library/react';
import { TenantryThemeProvider } from '@tenantry/ui';
import { describe, expect, it } from 'vitest';
import { DemoSignIns } from './DemoSignIns.js';

function show() {
  render(
    <TenantryThemeProvider>
      <DemoSignIns baseDomain="tenantry.example" password="public-demo" />
    </TenantryThemeProvider>,
  );
}

describe('the demo sign-ins', () => {
  it('lists an owner and a member with the workspace to open', () => {
    show();
    expect(screen.getByText('ada@example.test')).toBeInTheDocument();
    expect(screen.getByText('cy@example.test')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open Acme' })[0]).toHaveAttribute(
      'href',
      expect.stringContaining('acme.tenantry.example'),
    );
  });

  it('shows the password and says the demo resets', () => {
    show();
    expect(screen.getByText('public-demo')).toBeInTheDocument();
    expect(screen.getByText(/resets every night/i)).toBeInTheDocument();
  });
});
