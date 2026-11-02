// The subdomain picks the tenant: <slug>.<baseDomain>[:port]. Anything else has no tenant.
export function slugFromHost(host: string | undefined, baseDomain: string): string | null {
  if (!host) return null;
  const name = host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  const suffix = `.${baseDomain.toLowerCase()}`;
  if (!name.endsWith(suffix)) return null;
  const label = name.slice(0, -suffix.length);
  return /^[a-z0-9-]+$/.test(label) ? label : null;
}
