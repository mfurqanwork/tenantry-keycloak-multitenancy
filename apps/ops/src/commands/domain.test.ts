import { describe, expect, it } from 'vitest';
import { normaliseDomain } from './domain.js';

describe('normaliseDomain', () => {
  it('lower-cases and drops one trailing dot, so one domain is one row', () => {
    expect(normaliseDomain('Acme.Test.')).toBe('acme.test');
    expect(normaliseDomain(' acme.co.uk ')).toBe('acme.co.uk');
  });

  it('refuses what is not a domain name', () => {
    for (const bad of [
      '',
      'localhost',
      'acme',
      'http://acme.test',
      'acme .test',
      '-acme.test',
      'acme-.test',
      'a..test',
      '*.acme.test',
    ]) {
      expect(normaliseDomain(bad)).toBeNull();
    }
  });
});
