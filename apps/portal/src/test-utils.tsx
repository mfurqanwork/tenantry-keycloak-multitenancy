import { renderWithApp } from '@tenantry/app-kit/testing';
import { ROLE_PERMISSIONS, type Permission } from '@tenantry/auth';

export { fakeApi, makeMe } from '@tenantry/app-kit/testing';
// The portal's pages rendered with theme, router, API and person (shared with the web app).
export const renderPortal = renderWithApp;
// The name the pages moved from the web app (People, Audit log) use in their tests.
export const renderPage = renderWithApp;

export const OWNER: Permission[] = [...ROLE_PERMISSIONS.owner];
export const ADMIN: Permission[] = [...ROLE_PERMISSIONS.admin];
export const ALL: Permission[] = [...ROLE_PERMISSIONS.admin];
export const MEMBER: Permission[] = [...ROLE_PERMISSIONS.member];

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
