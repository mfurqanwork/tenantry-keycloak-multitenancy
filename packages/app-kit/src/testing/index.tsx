import { render, type RenderResult } from '@testing-library/react';
import type { Permission } from '@tenantry/auth';
import { TenantryThemeProvider } from '@tenantry/ui';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { ApiProvider, type Api } from '../api.js';
import { MeProvider, type Me } from '../me.js';

// Test helpers both apps share (@tenantry/app-kit/testing); never imported by app code.

export function makeMe(role: Me['role'], permissions: Permission[]): Me {
  return {
    user: { id: 'u-me', email: 'me@example.com', displayName: 'Me' },
    tenant: { slug: 'acme', name: 'Acme', tier: 'enterprise' },
    role,
    permissions,
  };
}

export type FakeApi = Api & { [K in keyof Api]: ReturnType<typeof vi.fn> };

// Each route answers from a table: "<METHOD> path" (GET has no method) → value, or an Error to reject with.
export function fakeApi(routes: Record<string, unknown> = {}): FakeApi {
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
  } as never;
}

// A page as the app shows it: theme, router (at a path, with optional history state), API and person.
export function renderWithApp(
  ui: ReactNode,
  { api, me, path = '/', state }: { api: Api; me: Me; path?: string; state?: unknown },
): RenderResult {
  return render(
    <TenantryThemeProvider>
      <MemoryRouter initialEntries={[state === undefined ? path : { pathname: path, state }]}>
        <ApiProvider api={api}>
          <MeProvider value={me}>{ui}</MeProvider>
        </ApiProvider>
      </MemoryRouter>
    </TenantryThemeProvider>,
  );
}
