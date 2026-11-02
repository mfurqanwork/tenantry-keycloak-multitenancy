export interface AuthConfig {
  issuer: string;
  clientId: string;
  // The Keycloak organization alias to sign in to; null on the apex host (signup).
  organization: string | null;
}

// Before login the SPA knows only its hostname; the API says which realm and organization it maps to.
export async function fetchAuthConfig(
  slug: string,
  fetchFn: typeof fetch = fetch,
): Promise<AuthConfig | null> {
  const res = await fetchFn(`/api/tenants/${encodeURIComponent(slug)}/auth-config`, {
    headers: { accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`auth-config for ${slug} failed with ${String(res.status)}`);
  return (await res.json()) as AuthConfig;
}
