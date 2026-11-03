import { render, screen } from '@testing-library/react';
import KcPage from './KcPage.js';
import { getKcContextMock } from './mock.js';

describe('KcPage', () => {
  it('renders the identity-first page inside the Tenantry frame', async () => {
    const { container } = render(<KcPage kcContext={getKcContextMock({ pageId: 'login-username.ftl' })} />);
    expect(await screen.findByLabelText(/username/i)).toHaveClass('cds--text-input');
    expect(container.querySelector('[data-tenantry-theme]')).not.toBeNull();
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
