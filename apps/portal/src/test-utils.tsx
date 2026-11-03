import { render, type RenderResult } from '@testing-library/react';
import type { Permission } from '@tenantry/auth';
import { ApiProvider, MeProvider, type Api, type Me } from '@tenantry/app-kit';
import { TenantryThemeProvider } from '@tenantry/ui';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

export const OWNER: Permission[] = ['members:read', 'audit:read', 'tenant:settings'];
export const ADMIN: Permission[] = ['members:read', 'audit:read'];

export function makeMe(role: Me['role'], permissions: Permission[]): Me {
  return {
    user: { id: 'u-me', email: 'me@example.com', displayName: 'Me' },
    tenant: { slug: 'acme', name: 'Acme', tier: 'enterprise' },
    role,
    permissions,
  };
}

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

// Each route answers from a table: "<METHOD> path" (GET has no method) → value, or an Error to reject with.
export function fakeApi(routes: Record<string, unknown> = {}) {
  const answer = (key: string) => {
    const value = routes[key];
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
  };
  return {
    get: vi.fn((path: string) => answer(path)),
    post: vi.fn((path: string) => answer(`POST ${path}`)),
    put: vi.fn((path: string) => answer(`PUT ${path}`)),
    patch: vi.fn((path: string) => answer(`PATCH ${path}`)),
    del: vi.fn((path: string) => answer(`DELETE ${path}`)),
    upload: vi.fn((path: string) => answer(`UPLOAD ${path}`)),
  };
}

export function renderPortal(
  ui: ReactNode,
  { api, me, path = '/', state }: { api: ReturnType<typeof fakeApi>; me: Me; path?: string; state?: unknown },
): RenderResult {
  return render(
    <TenantryThemeProvider>
      <MemoryRouter initialEntries={[state === undefined ? path : { pathname: path, state }]}>
        <ApiProvider api={api as unknown as Api}>
          <MeProvider value={me}>{ui}</MeProvider>
        </ApiProvider>
      </MemoryRouter>
    </TenantryThemeProvider>,
  );
}
