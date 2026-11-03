import type { TenantApp } from '@tenantry/auth';

const LABEL = /^[a-z0-9-]+$/;

// The subdomain picks the tenant: <slug>.<baseDomain> is the web app, <slug>.portal.<baseDomain> the
// portal, each with an optional port. Anything else has no tenant.
export function tenantFromHost(
  host: string | undefined,
  baseDomain: string,
): { slug: string; app: TenantApp } | null {
  if (!host) return null;
  const name = host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  const suffix = `.${baseDomain.toLowerCase()}`;
  if (!name.endsWith(suffix)) return null;
  const labels = name.slice(0, -suffix.length).split('.');
  const [slug, second] = labels;
  if (!slug || !LABEL.test(slug)) return null;
  if (labels.length === 1) return slug === 'portal' ? null : { slug, app: 'web' };
  if (labels.length === 2 && second === 'portal') return { slug, app: 'portal' };
  return null;
}

export function slugFromHost(host: string | undefined, baseDomain: string): string | null {
  return tenantFromHost(host, baseDomain)?.slug ?? null;
}
