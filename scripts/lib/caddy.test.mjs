import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const caddy = readFileSync(new URL('../../infra/Caddyfile', import.meta.url), 'utf8');
const site = (name) => {
  const start = caddy.indexOf(`http://${name}:`);
  assert.ok(start >= 0, `no site ${name}`);
  const end = caddy.indexOf('\nhttp://', start + 1);
  return caddy.slice(start, end < 0 ? undefined : end);
};

// The SCIM gateway is the tenant's own address (ADR-0024): <slug>.<base>/scim/v2 reaches the API.
test('tenant web hosts send /scim/* to the API', () => {
  assert.match(site('*.tenantry.localhost'), /handle \/scim\/\* \{\s+reverse_proxy \{\$API_UPSTREAM\}/);
});

test('the portal and the apex do not serve SCIM', () => {
  assert.doesNotMatch(site('*.portal.tenantry.localhost'), /\/scim/);
  assert.doesNotMatch(site('tenantry.localhost'), /\/scim/);
});

// After an update the browser must fetch the new index.html, or it keeps running the old app (Phase 6a);
// the hashed files under /assets/ may be cached for good.
for (const app of ['web', 'portal']) {
  test(`${app}'s index.html is checked again on every load; its assets are cached`, () => {
    const spa = readFileSync(new URL(`../../apps/${app}/Caddyfile.spa`, import.meta.url), 'utf8');
    assert.match(spa, /@page not path \/assets\/\*\s+header @page Cache-Control "no-cache"/);
    assert.match(spa, /header \/assets\/\* Cache-Control "public, max-age=31536000, immutable"/);
  });
}
