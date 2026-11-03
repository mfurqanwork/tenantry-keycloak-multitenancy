import { parseHex } from '@tenantry/brand';

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
const LABEL = /^[a-z0-9-]+$/;

// The workspace a host belongs to: <slug>.<base> (web) or <slug>.portal.<base> (portal); else none.
function slugOf(hostname: string, baseDomain: string): string | null {
  const suffix = `.${baseDomain.toLowerCase()}`;
  const name = hostname.toLowerCase();
  if (!name.endsWith(suffix)) return null;
  const labels = name.slice(0, -suffix.length).split('.');
  const [slug, second] = labels;
  if (!slug || !LABEL.test(slug) || slug === 'portal') return null;
  if (labels.length === 1 || (labels.length === 2 && second === 'portal')) return slug;
  return null;
}

// The first login page's URL carries the app's redirect_uri, whose host names the workspace. Later pages
// (a wrong password, the password step) do not, so the tenant is kept for this tab. Only addresses under
// our base domain count: Keycloak's own error page also renders here, for any redirect_uri.
export function tenantFromLocation(search: string, storage: Storage, baseDomain: string): LoginTenant | null {
  const redirect = new URLSearchParams(search).get('redirect_uri');
  if (redirect !== null) {
    let tenant: LoginTenant | null = null;
    try {
      const url = new URL(redirect);
      const slug = slugOf(url.hostname, baseDomain);
      if (slug) tenant = { origin: url.origin, slug };
    } catch {
      // Not a URL: no tenant from this page.
    }
    if (tenant) storage.setItem(KEY, JSON.stringify(tenant));
    else storage.removeItem(KEY);
    return tenant;
  }
  try {
    const stored = JSON.parse(storage.getItem(KEY) ?? 'null') as LoginTenant | null;
    return stored && typeof stored.origin === 'string' && typeof stored.slug === 'string' ? stored : null;
  } catch {
    return null;
  }
}

// The workspace's public branding, read from its own address (the API allows the auth origin).
// Any failure gives null, and the page shows the Tenantry brand; a colour that is not #rrggbb is dropped.
export async function loadTenantBrand(
  tenant: LoginTenant,
  fetchFn: typeof fetch = fetch,
): Promise<TenantBrand | null> {
  try {
    const res = await fetchFn(`${tenant.origin}/api/tenants/${encodeURIComponent(tenant.slug)}/branding`);
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<TenantBrand>;
    if (typeof body.name !== 'string') return null;
    return {
      name: body.name,
      primaryColor:
        typeof body.primaryColor === 'string' && parseHex(body.primaryColor) ? body.primaryColor : null,
      logoUrl: typeof body.logoUrl === 'string' ? new URL(body.logoUrl, tenant.origin).toString() : null,
    };
  } catch {
    return null;
  }
}
