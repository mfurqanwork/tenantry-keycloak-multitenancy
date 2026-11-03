import { describe, expect, it } from 'vitest';
import { joinTxt, verificationRecord } from './txt.js';

describe('TXT records', () => {
  it('joins the strings a long TXT record is split into', () => {
    expect(joinTxt([['tenantry-verify=', 'abc'], ['other']])).toEqual(['tenantry-verify=abc', 'other']);
  });

  it('names the verification record for a domain', () => {
    expect(verificationRecord('acme.test', 'tok')).toEqual({
      name: '_tenantry-verify.acme.test',
      value: 'tenantry-verify=tok',
    });
  });
});
