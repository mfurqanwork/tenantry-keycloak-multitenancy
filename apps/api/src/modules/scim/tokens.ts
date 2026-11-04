import { createHash, randomBytes } from 'node:crypto';

const PREFIX = 'tnt_scim_';

// Shown once; only the hash is kept (ADR-0024). The prefix lets secret scanners find a leaked one.
export function newScimToken(): { token: string; hash: Buffer } {
  const token = `${PREFIX}${randomBytes(32).toString('base64url')}`;
  return { token, hash: hashScimToken(token) };
}

export function hashScimToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}
