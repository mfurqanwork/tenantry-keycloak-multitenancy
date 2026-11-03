export interface LoginTenant {
  origin: string;
  slug: string;
}

export interface TenantBrand {
  name: string;
  primaryColor: string | null;
  logoUrl: string | null;
}

const KEY = 'tenantry.login.tenant';

// The first login page's URL carries the app's redirect_uri, whose host names the workspace
// (<slug>.<base> or <slug>.portal.<base>). Later pages (a wrong password, the password step) do not,
// so the tenant is kept for this tab. Keycloak only shows the page for a registered redirect URI.
export function tenantFromLocation(search: string, storage: Storage): LoginTenant | null {
  const redirect = new URLSearchParams(search).get('redirect_uri');
  if (redirect) {
    try {
      const url = new URL(redirect);
      const slug = url.hostname.split('.')[0] ?? '';
      if (slug) {
        const tenant = { origin: url.origin, slug };
        storage.setItem(KEY, JSON.stringify(tenant));
        return tenant;
      }
    } catch {
      // Not a URL: no tenant from this page.
    }
    return null;
  }
  try {
    const stored = JSON.parse(storage.getItem(KEY) ?? 'null') as LoginTenant | null;
    return stored && typeof stored.origin === 'string' && typeof stored.slug === 'string' ? stored : null;
  } catch {
    return null;
  }
}

// The workspace's public branding, read from its own address (the API allows the auth origin).
// Any failure gives null, and the page shows the Tenantry brand.
export async function loadTenantBrand(
  tenant: LoginTenant,
  fetchFn: typeof fetch = fetch,
): Promise<TenantBrand | null> {
  try {
    const res = await fetchFn(`${tenant.origin}/api/tenants/${encodeURIComponent(tenant.slug)}/branding`);
    if (!res.ok) return null;
    const body = (await res.json()) as TenantBrand;
    return {
      name: body.name,
      primaryColor: body.primaryColor,
      logoUrl: body.logoUrl ? new URL(body.logoUrl, tenant.origin).toString() : null,
    };
  } catch {
    return null;
  }
}
