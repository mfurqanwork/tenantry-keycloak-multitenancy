import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welcomeUrl } from './urls.mjs';

// `pnpm dev:stack` ends by printing where to start: the welcome page (Phase 6a), not a workspace that may
// not exist.
test('the welcome page on port 80 has no port in its address', () => {
  assert.equal(welcomeUrl(80), 'http://tenantry.localhost');
});

test('the welcome page on another port names it', () => {
  assert.equal(welcomeUrl(8080), 'http://tenantry.localhost:8080');
});
