import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeApi, makeMe, OWNER, renderPortal, WORKSPACES } from '../../test-utils.js';
import { DashboardRoute } from './DashboardRoute.js';

const api = () => fakeApi({ '/api/me/workspaces': WORKSPACES });

describe('DashboardRoute', () => {
  it('links console users to their realm console', () => {
    const me = { ...makeMe('admin', OWNER), consoleUrl: 'http://auth.test/admin/ent-acme/console/' };
    renderPortal(<DashboardRoute />, { api: api(), me });
    expect(screen.getByRole('link', { name: 'Open the Keycloak console' })).toHaveAttribute(
      'href',
      'http://auth.test/admin/ent-acme/console/',
    );
  });

  it('shows no console link to anyone else', () => {
    renderPortal(<DashboardRoute />, { api: api(), me: makeMe('owner', OWNER) });
    expect(screen.queryByRole('link', { name: 'Open the Keycloak console' })).not.toBeInTheDocument();
  });
});
