import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('portal app', () => {
  it('shows its own product name and the tenant from the subdomain', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App hostname="demo.portal.tenantry.localhost" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('banner')).toHaveTextContent('Tenantry Portal');
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('demo')).toBeInTheDocument();
  });
});
