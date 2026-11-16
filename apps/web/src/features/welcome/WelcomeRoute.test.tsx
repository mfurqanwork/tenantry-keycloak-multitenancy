import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { TenantryThemeProvider } from '@tenantry/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WelcomeRoute } from './WelcomeRoute.js';

const assign = vi.fn();
const realLocation = window.location;

function renderWelcome(demoWorkspaces: string[] = [], demoPassword?: string) {
  vi.stubGlobal('location', { href: realLocation.href, assign, protocol: 'http:', port: '' });
  render(
    <TenantryThemeProvider>
      <WelcomeRoute baseDomain="tenantry.localhost" demoWorkspaces={demoWorkspaces} demoPassword={demoPassword} />
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
    const headline = screen.getByRole('heading', { level: 1 });
    expect(headline).toHaveTextContent(/Tenantry/);
    expect(within(headline).getByText('Tenantry')).toHaveClass('opal-text');
    expect(
      screen.getByText('Sign-in, teams and branding for every customer workspace, built on Keycloak.'),
    ).toBeInTheDocument();
  });

  it('Create a workspace goes to signup', () => {
    renderWelcome();
    const links = screen.getAllByRole('link', { name: 'Create a workspace' });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) expect(link).toHaveAttribute('href', '/signup');
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Create a workspace' })).toBeInTheDocument();
  });

  it('links the docs and the code from the top bar', () => {
    renderWelcome();
    const bar = within(screen.getByRole('banner'));
    expect(bar.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', expect.stringContaining('github.com'));
    expect(bar.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', expect.stringContaining('github.com'));
    expect(bar.getByRole('link', { name: 'Go to your workspace' })).toHaveAttribute('href', '#go');
  });

  it('welcome shows technology logos', () => {
    renderWelcome();
    for (const name of ['Keycloak', 'PostgreSQL', 'Docker', 'OpenID Connect']) {
      expect(screen.getByRole('img', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('SCIM')).toBeInTheDocument();
  });

  it('compares Standard and Enterprise, and names the three isolation layers', () => {
    renderWelcome();
    expect(screen.getByRole('heading', { name: 'Standard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Enterprise/ })).toBeInTheDocument();
    for (const name of ['Token', 'API', 'Database']) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument();
    }
  });

  it('shows the Home screenshot that matches the theme', () => {
    renderWelcome();
    const shot = screen.getByRole('img', { name: /Home/ });
    expect(shot).toHaveAttribute('src', '/welcome/home-light.png');
    expect(shot.closest('picture')?.querySelector('source')).toHaveAttribute('srcset', '/welcome/home-dark.png');
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
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a workspace address, such as pengopal');
    expect(screen.getByLabelText('Workspace address')).toHaveAttribute('aria-invalid', 'true');
    expect(assign).not.toHaveBeenCalled();
  });

  it('shows no demo and no "Try the demo" unless some are configured', () => {
    renderWelcome();
    expect(screen.queryByText('Try a demo workspace')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Try the demo' })).not.toBeInTheDocument();
  });

  it('links each demo workspace, and Try the demo goes to them', () => {
    renderWelcome(['acme', 'globex']);
    expect(screen.getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '#demo');
    expect(screen.getByText('Try a demo workspace')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'acme' })).toHaveAttribute('href', 'http://acme.tenantry.localhost/');
    expect(screen.getByRole('link', { name: 'globex' })).toHaveAttribute('href', 'http://globex.tenantry.localhost/');
  });

  it('has a footer', () => {
    renderWelcome();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/Tenantry/);
  });
});
