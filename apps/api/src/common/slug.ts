const FORMAT = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;
// Hostnames the platform itself uses, or that would read as ours.
const RESERVED = new Set(['www', 'auth', 'mail', 'api', 'portal', 'app', 'admin', 'tenantry']);

export type SlugCheck = { ok: true } | { ok: false; reason: 'format' | 'reserved' };

export function validateSlug(slug: string): SlugCheck {
  if (!FORMAT.test(slug)) return { ok: false, reason: 'format' };
  if (RESERVED.has(slug)) return { ok: false, reason: 'reserved' };
  return { ok: true };
}
