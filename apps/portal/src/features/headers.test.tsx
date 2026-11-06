import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ALL, fakeApi, makeMe, OWNER, renderPage } from '../test-utils.js';
import { ApplicationsRoute } from './applications/ApplicationsRoute.js';
import { AuditRoute } from './audit/AuditRoute.js';
import { BrandingRoute } from './branding/BrandingRoute.js';
import { ScimRoute } from './scim/ScimRoute.js';
import { SecurityRoute } from './security/SecurityRoute.js';

const api = () =>
  fakeApi({
    '/api/audit': {
      entries: [
        {
          id: 'e1',
          createdAt: '2026-11-08T10:00:00Z',
          actor: { userId: 'u1', email: 'ada@example.test' },
          action: 'branding.updated',
          target: 't1',
          targetLabel: null,
          metadata: {},
        },
        {
          id: 'e2',
          createdAt: '2026-11-08T09:00:00Z',
          actor: { userId: 'u2', email: 'ben@example.test' },
          action: 'member.joined',
          target: 'u2',
          targetLabel: 'ben@example.test',
          metadata: {},
        },
      ],
      nextBefore: null,
    },
    '/api/apps': { apps: [] },
    '/api/tenants/acme/branding': { name: 'Acme', primaryColor: null, logoUrl: null },
    '/api/security': {
      twoStep: 'off',
      passwordMinLength: 12,
      passwordHistory: 0,
      passwordExpiryDays: 0,
      sessionIdleMinutes: 30,
      sessionMaxHours: 10,
      lockoutAttempts: 5,
    },
    '/api/scim': { url: 'http://acme.tenantry.localhost/scim/v2', token: null, defaultRole: 'member' },
  });

const pages: [string, string, ReactNode][] = [
  ['Audit log', 'Every change to people, sign-in and settings, newest first.', <AuditRoute key="a" />],
  [
    'Customer apps',
    'Your own apps that sign people in through this workspace.',
    <ApplicationsRoute key="c" />,
  ],
  [
    'Branding',
    'Your colour and logo, on the apps and the sign-in page.',
    <BrandingRoute key="b" onChanged={() => undefined} />,
  ],
  ['Sign-in & security', 'Two-step sign-in, passwords, sessions and lockout.', <SecurityRoute key="s" />],
  ['Directory sync (SCIM)', 'Keep people in step with Entra ID or Okta.', <ScimRoute key="d" />],
];

describe("Admin's pages, redesigned (spec 8.2)", () => {
  it.each(pages)('%s has its icon and a line on what it is for', async (title, description, page) => {
    const me = makeMe('owner', [...OWNER]);
    renderPage(page, { api: api(), me: { ...me, tenant: { ...me.tenant, tier: 'enterprise' } } });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: title }).querySelector('svg')).not.toBeNull();
    });
    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it('the audit log filters entries by who, what or which', async () => {
    renderPage(<AuditRoute />, { api: api(), me: makeMe('owner', ALL), path: '/audit?q=joined' });
    expect(await screen.findByText('member.joined')).toBeInTheDocument();
    expect(screen.queryByText('branding.updated')).toBeNull();
    const user = userEvent.setup();
    const search = screen.getByRole('searchbox', { name: 'Search the audit log' });
    await user.clear(search);
    await user.type(search, 'ada@');
    expect(screen.getByText('branding.updated')).toBeInTheDocument();
    expect(screen.queryByText('member.joined')).toBeNull();
  });

  it('customer apps start from an invitation, not an empty table', async () => {
    const me = makeMe('owner', [...OWNER]);
    renderPage(<ApplicationsRoute />, {
      api: api(),
      me: { ...me, tenant: { ...me.tenant, tier: 'enterprise' } },
    });
    expect(await screen.findByRole('heading', { name: 'Connect your first app' })).toBeInTheDocument();
  });
});
