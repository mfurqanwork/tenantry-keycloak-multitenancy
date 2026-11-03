import { renderWithApp } from '@tenantry/app-kit/testing';
import type { Permission } from '@tenantry/auth';

export { fakeApi, makeMe } from '@tenantry/app-kit/testing';
// The portal's pages rendered with theme, router, API and person (shared with the web app).
export const renderPortal = renderWithApp;

export const OWNER: Permission[] = ['members:read', 'audit:read', 'tenant:settings'];
export const ADMIN: Permission[] = ['members:read', 'audit:read'];

export const WORKSPACES = [
  {
    slug: 'acme',
    name: 'Acme',
    current: true,
    webUrl: 'http://acme.tenantry.localhost/',
    portalUrl: 'http://acme.portal.tenantry.localhost/',
  },
  {
    slug: 'globex',
    name: 'Globex',
    current: false,
    webUrl: 'http://globex.tenantry.localhost/',
    portalUrl: 'http://globex.portal.tenantry.localhost/',
  },
];
