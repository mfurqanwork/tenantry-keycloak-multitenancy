import { InlineLoading } from '@carbon/react';
import type { Permission, Role } from '@tenantry/auth';
import { createContext, useContext, type ReactNode } from 'react';
import { ApiErrorNotification } from './ApiErrorNotification.js';
import { useResource } from './useResource.js';

// Who is signed in, in which tenant, and what they may do: GET /api/me. The UI shows controls from
// these permissions; the API decides again on every call.
export interface Me {
  user: { id: string; email: string | null; displayName: string | null };
  tenant: { slug: string; name: string; tier: 'standard' | 'enterprise' };
  role: Role | null;
  permissions: Permission[];
  // Set when the person may open their realm's Keycloak console (ADR-0026).
  consoleUrl?: string;
}

const MeContext = createContext<Me | null>(null);

export function MeProvider({ value, children }: { value: Me; children: ReactNode }) {
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe(): Me & { can: (permission: Permission) => boolean } {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe must be used inside <MeProvider>');
  return { ...me, can: (permission) => me.permissions.includes(permission) };
}

export function LoadMe({ children }: { children: ReactNode }) {
  const me = useResource<Me>('/api/me');
  if (me.error) return <ApiErrorNotification error={me.error} />;
  if (!me.data) return <InlineLoading description="Loading your workspace" />;
  return <MeProvider value={me.data}>{children}</MeProvider>;
}
