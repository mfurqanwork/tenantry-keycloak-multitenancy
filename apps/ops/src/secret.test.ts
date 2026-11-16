import { describe, expect, it } from 'vitest';
import { secretFrom } from './secret.js';

describe('secretFrom', () => {
  it('reads the secret from the named variable, never from the command line', () => {
    expect(secretFrom('CORP_SECRET', (key) => (key === 'CORP_SECRET' ? 's3cret' : undefined))).toBe('s3cret');
  });

  it('refuses a variable name that is not one', () => {
    expect(() => secretFrom('a secret value', () => 'x')).toThrow(/variable name/);
  });
});
