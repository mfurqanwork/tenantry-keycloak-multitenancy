import { describe, expect, it } from 'vitest';
import { listsReady, uriProblems } from './uri-lists.js';

const empty = { redirectUris: [], postLogoutRedirectUris: [], webOrigins: [] };

describe('URI lists of an app', () => {
  it('gives one problem (or none) per row, an empty list being one empty row', () => {
    expect(uriProblems([], 'redirectUris', 'web')).toEqual([null]);
    expect(uriProblems(['https://a.test/cb', 'http://localhost/cb', ' '], 'redirectUris', 'web')).toEqual([
      null,
      'Use 127.0.0.1 instead of localhost.',
      null,
    ]);
    expect(uriProblems(['https://a.test/x'], 'webOrigins', 'spa')).toEqual(['An origin has no path.']);
  });

  it('is ready when people have somewhere to land and nothing is wrong', () => {
    expect(listsReady('web', empty)).toBe(false);
    expect(listsReady('web', { ...empty, redirectUris: [' https://a.test/cb '] })).toBe(true);
    expect(listsReady('web', { ...empty, redirectUris: ['https://a.test/cb', 'http://x.test/cb'] })).toBe(
      false,
    );
    expect(listsReady('m2m', empty)).toBe(true);
  });
});
