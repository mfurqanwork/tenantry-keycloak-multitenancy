import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The product README and the setup docs link to files in the repository; a moved or missing one is a dead
// link on GitHub (Phase 6a).
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DOCS = [
  'README.md',
  'docs/SETUP.md',
  'docs/brand.md',
  'docs/demo-script.md',
  'docs/guides/deploy-azure.md',
  'tests/isolation/README.md',
];

function relativeTargets(markdown) {
  const targets = new Set();
  for (const [, href] of markdown.matchAll(/\]\(([^)\s]+)\)/g)) targets.add(href);
  for (const [, href] of markdown.matchAll(/(?:src|srcset)="([^"]+)"/g)) targets.add(href);
  return [...targets]
    .filter((href) => !/^(https?:|mailto:|#)/.test(href))
    .map((href) => href.split('#')[0])
    .filter(Boolean);
}

for (const doc of DOCS) {
  test(`${doc} links only to files that exist`, () => {
    const markdown = readFileSync(join(ROOT, doc), 'utf8');
    const missing = relativeTargets(markdown).filter((href) => {
      return !existsSync(join(ROOT, dirname(doc), href));
    });
    assert.deepEqual(missing, []);
  });
}
