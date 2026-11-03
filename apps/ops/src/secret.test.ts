import { describe, expect, it } from 'vitest';
import { secretFrom } from './secret.js';

describe('secretFrom', () => {
  it('reads the secret from the named variable, never from the command line', () => {
    expect(secretFrom('CORP_SECRET', (key) => (key === 'CORP_SECRET' ? 's3cret' : undefined))).toBe('s3cret');
  });

  it('defaults to IDP_CLIENT_SECRET', () => {
    expect(secretFrom(undefined, (key) => (key === 'IDP_CLIENT_SECRET' ? 'x' : undefined))).toBe('x');
  });

  it('says which variable is missing', () => {
    expect(() => secretFrom('NOPE', () => undefined)).toThrow(/NOPE is not set/);
  });

  it('refuses a variable name that is not one', () => {
    expect(() => secretFrom('a secret value', () => 'x')).toThrow(/variable name/);
  });
});
