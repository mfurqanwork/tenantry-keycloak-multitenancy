import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { TenantryThemeProvider } from '@tenantry/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotFoundPage } from './NotFoundPage.js';

const assign = vi.fn();
const realLocation = window.location;

afterEach(() => {
  vi.stubGlobal('location', realLocation);
  assign.mockReset();
});

describe('the not-found page', () => {
  it('offers the Go box and the way back to the welcome page', async () => {
    vi.stubGlobal('location', { href: realLocation.href, assign, protocol: 'http:', port: '8080' });
    render(
      <TenantryThemeProvider>
        <NotFoundPage signupUrl="http://tenantry.localhost:8080/" baseDomain="tenantry.localhost" />
      </TenantryThemeProvider>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Workspace not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the welcome page' })).toHaveAttribute(
      'href',
      'http://tenantry.localhost:8080/',
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Workspace address'), 'globex{Enter}');
    expect(assign).toHaveBeenCalledWith('http://globex.tenantry.localhost:8080/');
  });
});
