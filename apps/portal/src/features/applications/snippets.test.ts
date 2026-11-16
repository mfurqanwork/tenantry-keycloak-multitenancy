import { describe, expect, it } from 'vitest';
import { snippetsFor } from './snippets.js';
import { sampleApp } from './test-data.js';

describe('setup snippets', () => {
  it('fills each type with its issuer and client id, and never a real secret', () => {
    for (const type of ['web', 'spa', 'm2m'] as const) {
      const app = sampleApp({ type, clientId: `app-${type}0000` });
      const snippets = snippetsFor(app);
      expect(snippets.length).toBeGreaterThan(0);
      for (const s of snippets) {
        expect(s.code).toContain(app.connection.issuer);
        expect(s.code).toContain(app.clientId);
      }
    }
    expect(
      snippetsFor(sampleApp({ type: 'web' }))
        .map((s) => s.code)
        .join(),
    ).toContain('<your client secret>');
  });
});
