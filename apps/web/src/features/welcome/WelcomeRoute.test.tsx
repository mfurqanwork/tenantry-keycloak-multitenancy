import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { TenantryThemeProvider } from '@tenantry/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WelcomeRoute } from './WelcomeRoute.js';

const assign = vi.fn();
const realLocation = window.location;

function renderWelcome(demoWorkspaces: string[] = []) {
  vi.stubGlobal('location', { href: realLocation.href, assign, protocol: 'http:', port: '' });
  render(
    <TenantryThemeProvider>
      <WelcomeRoute baseDomain="tenantry.localhost" demoWorkspaces={demoWorkspaces} />
    </TenantryThemeProvider>,
  );
}

afterEach(() => {
  vi.stubGlobal('location', realLocation);
  assign.mockReset();
});

describe('the welcome page', () => {
  it('says what Tenantry is', () => {
    renderWelcome();
    expect(screen.getByRole('heading', { level: 1, name: 'Tenantry' })).toBeInTheDocument();
    expect(
      screen.getByText('Sign-in, teams and branding for every customer workspace, built on Keycloak.'),
    ).toBeInTheDocument();
  });

  it('starts a new workspace at /signup', () => {
    renderWelcome();
    expect(screen.getByRole('link', { name: 'Create a workspace' })).toHaveAttribute('href', '/signup');
  });

  it('opens the workspace a visitor types', async () => {
    renderWelcome();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Workspace address'), '  Acme ');
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(assign).toHaveBeenCalledWith('http://acme.tenantry.localhost/');
  });

  it('says what to type when the input cannot be a workspace', async () => {
    renderWelcome();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Workspace address'), 'a b{Enter}');
    expect(screen.getByText('Enter a workspace address, such as acme')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('shows no demo workspaces unless some are configured', () => {
    renderWelcome();
    expect(screen.queryByText('Try a demo workspace')).not.toBeInTheDocument();
  });

  it('links each demo workspace', () => {
    renderWelcome(['acme', 'globex']);
    expect(screen.getByText('Try a demo workspace')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'acme' })).toHaveAttribute(
      'href',
      'http://acme.tenantry.localhost/',
    );
    expect(screen.getByRole('link', { name: 'globex' })).toHaveAttribute(
      'href',
      'http://globex.tenantry.localhost/',
    );
  });
});
