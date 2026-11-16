import { describe, expect, it } from 'vitest';
import { verificationRecord } from './txt.js';

describe('TXT records', () => {
  it('names the verification record for a domain', () => {
    expect(verificationRecord('acme.test', 'tok')).toEqual({
      name: '_tenantry-verify.acme.test',
      value: 'tenantry-verify=tok',
    });
  });
});
