import { Resolver } from 'node:dns/promises';

// The record a company creates to prove it owns a domain (ADR-0022).
export function verificationRecord(domain: string, token: string): { name: string; value: string } {
  return { name: `_tenantry-verify.${domain}`, value: `tenantry-verify=${token}` };
}

// DNS splits a long TXT record into strings of at most 255 characters; a record is their join.
export function joinTxt(records: string[][]): string[] {
  return records.map((parts) => parts.join(''));
}

// TXT values for `name`, asked of `server` (host:port) when given, else the system resolver.
// A name with no records gives [].
export async function resolveTxt(name: string, server?: string): Promise<string[]> {
  const resolver = new Resolver({ timeout: 3000, tries: 2 });
  if (server) resolver.setServers([server]);
  try {
    return joinTxt(await resolver.resolveTxt(name));
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') return [];
    throw err;
  }
}
