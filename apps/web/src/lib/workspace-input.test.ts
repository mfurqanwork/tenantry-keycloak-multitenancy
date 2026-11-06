import { describe, expect, it } from 'vitest';
import { workspaceFromInput } from './workspace-input.js';

describe('workspaceFromInput', () => {
  it.each([
    '  Acme ',
    'ACME',
    'acme',
    'https://acme.tenantry.localhost/projects',
    'acme.tenantry.localhost:8080',
    'http://acme.portal.tenantry.localhost/people',
  ])('reads %j as acme', (input) => {
    expect(workspaceFromInput(input, 'tenantry.localhost')).toBe('acme');
  });

  it.each(['', '   ', 'a b', '-acme', 'acme-', 'a', '9lives', 'acme_corp', 'x'.repeat(33)])(
    'refuses %j',
    (input) => {
      expect(workspaceFromInput(input, 'tenantry.localhost')).toBeNull();
    },
  );
});
