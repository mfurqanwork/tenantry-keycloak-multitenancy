import { render, type RenderResult } from '@testing-library/react';
import type { Permission } from '@tenantry/auth';
import { TenantryThemeProvider } from '@tenantry/ui';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { type Api, ApiProvider, type Me, MeProvider } from '@tenantry/app-kit';

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

export function makeMe(role: Me['role'], permissions: Permission[]): Me {
  return {
    user: { id: 'u-me', email: 'me@example.com', displayName: 'Me' },
    tenant: { slug: 'acme', name: 'Acme', tier: 'enterprise' },
    role,
    permissions,
  };
}

// Each route answers from a table: path → value, or an Error to reject with.
export function fakeApi(
  routes: Record<string, unknown> = {},
): Api & { [K in keyof Api]: ReturnType<typeof vi.fn> } {
  const answer = (path: string) => {
    const value = routes[path];
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
  };
  return {
    get: vi.fn(answer),
    post: vi.fn((path: string) => answer(`POST ${path}`)),
    put: vi.fn((path: string) => answer(`PUT ${path}`)),
    patch: vi.fn((path: string) => answer(`PATCH ${path}`)),
    upload: vi.fn((path: string) => answer(`UPLOAD ${path}`)),
    del: vi.fn((path: string) => answer(`DELETE ${path}`)),
  } as never;
}

export function renderPage(
  ui: ReactNode,
  { api, me, path = '/' }: { api: Api; me: Me; path?: string },
): RenderResult {
  return render(
    <TenantryThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <ApiProvider api={api}>
          <MeProvider value={me}>{ui}</MeProvider>
        </ApiProvider>
      </MemoryRouter>
    </TenantryThemeProvider>,
  );
}
