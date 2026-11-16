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
      <WelcomeRoute
        baseDomain="tenantry.localhost"
        demoWorkspaces={demoWorkspaces}
        demoPassword={demoPassword}
      />
    </TenantryThemeProvider>,
  );
}

afterEach(() => {
  vi.stubGlobal('location', realLocation);
  assign.mockReset();
});

describe('the welcome page', () => {
  it('Create a workspace goes to signup', () => {
    renderWelcome();
    const links = screen.getAllByRole('link', { name: 'Create a workspace' });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) expect(link).toHaveAttribute('href', '/signup');
    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Create a workspace' }),
    ).toBeInTheDocument();
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

  it('links each demo workspace, and Try the demo goes to them', () => {
    renderWelcome(['acme', 'globex']);
    expect(screen.getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '#demo');
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
