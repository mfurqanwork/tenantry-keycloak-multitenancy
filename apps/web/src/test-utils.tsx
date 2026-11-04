import { renderWithApp } from '@tenantry/app-kit/testing';
import type { Permission } from '@tenantry/auth';

export { fakeApi, makeMe } from '@tenantry/app-kit/testing';
// The web app's pages rendered with theme, router, API and person (shared with the portal).
export const renderPage = renderWithApp;

export const ALL: Permission[] = [
  'members:read',
  'members:invite',
  'members:remove',
  'members:change-role',
  'audit:read',
  'projects:read',
  'projects:write',
];
export const MEMBER: Permission[] = ['members:read', 'apps:read', 'projects:read', 'projects:write'];
