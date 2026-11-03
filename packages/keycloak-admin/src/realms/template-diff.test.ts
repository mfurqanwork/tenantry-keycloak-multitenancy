import { describe, expect, it } from 'vitest';
import { diffTemplate } from './template-diff.js';

describe('diffTemplate', () => {
  it('reports nothing when the live object holds every templated value', () => {
    expect(diffTemplate({ a: 1, b: { c: 'x' } }, { a: 1, b: { c: 'x', extra: true }, more: 2 })).toEqual([]);
  });

  it('ignores keys the template does not set', () => {
    expect(diffTemplate({ a: 1 }, { a: 1, keycloakDefault: 'whatever' })).toEqual([]);
  });

  it('reports a changed value with its path', () => {
    expect(
      diffTemplate({ realm: { accessTokenLifespan: 300 } }, { realm: { accessTokenLifespan: 900 } }),
    ).toEqual([{ path: 'realm.accessTokenLifespan', live: 900, template: 300 }]);
  });

  it('reports a missing value', () => {
    expect(diffTemplate({ smtpServer: { host: 'mailpit' } }, {})).toEqual([
      { path: 'smtpServer', live: undefined, template: { host: 'mailpit' } },
    ]);
  });

  it('compares arrays as wholes, ignoring order of plain strings', () => {
    expect(diffTemplate({ uris: ['a', 'b'] }, { uris: ['b', 'a'] })).toEqual([]);
    expect(diffTemplate({ uris: ['a'] }, { uris: ['a', 'b'] })).toEqual([
      { path: 'uris', live: ['a', 'b'], template: ['a'] },
    ]);
  });

  it('treats "true" and true as the same (Keycloak returns attributes as strings)', () => {
    expect(diffTemplate({ flag: true, port: 1025 }, { flag: 'true', port: '1025' })).toEqual([]);
  });
});
