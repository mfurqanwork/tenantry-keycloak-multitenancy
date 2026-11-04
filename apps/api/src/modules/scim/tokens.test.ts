import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashScimToken, newScimToken } from './tokens.js';

describe('SCIM tokens', () => {
  it('are tnt_scim_ and 32 random bytes in base64url', () => {
    const { token } = newScimToken();
    expect(token).toMatch(/^tnt_scim_[A-Za-z0-9_-]{43}$/);
    expect(newScimToken().token).not.toBe(token);
  });

  it('are kept as the SHA-256 of the whole token', () => {
    const { token, hash } = newScimToken();
    expect(hash.equals(createHash('sha256').update(token).digest())).toBe(true);
    expect(hashScimToken(token).equals(hash)).toBe(true);
  });
});
