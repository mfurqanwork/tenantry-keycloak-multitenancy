import type { AuthConfig } from '@tenantry/oidc-client';
import { workspaceFromInput } from './workspace-input.js';

export type HostKind = { kind: 'apex' } | { kind: 'tenant'; slug: string } | { kind: 'unknown' };

export const BASE_DOMAIN: string =
  (import.meta.env['VITE_TENANTRY_BASE_DOMAIN'] as string | undefined) ?? 'tenantry.localhost';

// The same rule as the API's: the base domain is signup; one label in front of it is a tenant.
export function hostKind(hostname: string, baseDomain: string): HostKind {
  const name = hostname.toLowerCase().replace(/\.$/, '');
  const base = baseDomain.toLowerCase();
  if (name === base) return { kind: 'apex' };
  if (!name.endsWith(`.${base}`)) return { kind: 'unknown' };
  const label = name.slice(0, -(base.length + 1));
  return /^[a-z0-9-]+$/.test(label) ? { kind: 'tenant', slug: label } : { kind: 'unknown' };
}

// Signup has no tenant to ask about yet: sign in to the platform realm on auth.<base domain>.
export function apexAuthConfig(location: URL, baseDomain: string): AuthConfig {
  const port = location.port ? `:${location.port}` : '';
  return {
    issuer: `${location.protocol}//auth.${baseDomain}${port}/realms/platform`,
    clientId: 'tenantry-web',
    organization: null,
  };
}

// The base domain's pages: the welcome page needs no sign-in; signup (and its sign-in callback) do.
export function apexPage(pathname: string): 'welcome' | 'signup' {
  return pathname === '/signup' || pathname === '/auth/callback' ? 'signup' : 'welcome';
}

// VITE_DEMO_WORKSPACES: slugs the welcome page offers to try (empty in production).
export function demoWorkspaces(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((slug) => slug.trim())
    .filter((slug) => workspaceFromInput(slug, BASE_DOMAIN) === slug);
}

export const DEMO_WORKSPACES = demoWorkspaces(import.meta.env['VITE_DEMO_WORKSPACES'] as string | undefined);
