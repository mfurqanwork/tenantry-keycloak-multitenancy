import { render, screen } from '@testing-library/react';
import KcPage from './KcPage.js';
import { getKcContextMock } from './mock.js';

describe('KcPage', () => {
  it('renders the identity-first page inside the Tenantry frame', async () => {
    const { container } = render(<KcPage kcContext={getKcContextMock({ pageId: 'login-username.ftl' })} />);
    expect(await screen.findByLabelText(/username/i)).toHaveClass('border-input');
    expect(container.querySelector('[data-tenantry-theme]')).not.toBeNull();
    expect(container.querySelector('[class*="cds--"]')).toBeNull();
  });

  it('provider button shows its logo', async () => {
    const { container } = render(
      <KcPage
        kcContext={getKcContextMock({
          pageId: 'login-username.ftl',
          overrides: {
            social: {
              displayInfo: true,
              providers: [
                { alias: 'acme-corp', providerId: 'oidc', displayName: 'Acme Corp', loginUrl: '/broker/acme', iconClasses: '' },
                { alias: 'github', providerId: 'github', displayName: 'GitHub', loginUrl: '/broker/github', iconClasses: '' },
              ],
            },
          },
        })}
      />,
    );
    const acme = await screen.findByRole('link', { name: 'Continue with Acme Corp' });
    const github = screen.getByRole('link', { name: 'Continue with GitHub' });
    expect(acme).toHaveAttribute('href', '/broker/acme');
    expect(acme.querySelector('[data-logo]')).toHaveAttribute('data-logo', 'key');
    expect(github.querySelector('[data-logo]')).toHaveAttribute('data-logo', 'github');
    expect(github.querySelector('svg')).not.toBeNull();
    // Company sign-in comes first, above the password form.
    const username = screen.getByLabelText(/username/i);
    expect(acme.compareDocumentPosition(username) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('or sign in with a password')).toBeInTheDocument();
    expect(container.querySelector('#kc-social-providers')).toBeNull();
  });

  it('shows the error Keycloak sends with the page', async () => {
    render(
      <KcPage
        kcContext={getKcContextMock({
          pageId: 'login-password.ftl',
          overrides: { message: { type: 'error', summary: 'Invalid password.' } },
        })}
      />,
    );
    expect(await screen.findByText('Invalid password.')).toBeInTheDocument();
  });
});
