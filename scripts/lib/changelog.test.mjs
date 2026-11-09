import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addsToUnreleased,
  cutRelease,
  isHigher,
  needsChangelog,
  parseVersion,
  releaseNotes,
  unreleasedBody,
} from './changelog.mjs';

const REPO = 'https://github.com/o/r';
const LOG = `# Changelog

Intro.

## [Unreleased]

### Added

- A thing.

## [0.1.0] - 2026-11-03

### Added

- First.

[0.1.0]: ${REPO}/releases/tag/v0.1.0
`;
const EMPTY = LOG.replace('### Added\n\n- A thing.\n\n', '');

test('parseVersion takes x.y.z only', () => {
  assert.deepEqual(parseVersion('1.20.3'), [1, 20, 3]);
  for (const bad of ['1.2', 'v1.2.3', '1.2.3-rc1', '01.2.3', '']) assert.equal(parseVersion(bad), null, bad);
});

test('isHigher compares numerically', () => {
  assert.equal(isHigher('0.10.0', '0.9.9'), true);
  assert.equal(isHigher('0.9.9', '0.10.0'), false);
  assert.equal(isHigher('1.0.0', '1.0.0'), false);
});

test('unreleasedBody is the text under Unreleased', () => {
  assert.equal(unreleasedBody(LOG), '### Added\n\n- A thing.');
  assert.equal(unreleasedBody(EMPTY), '');
});

test('cutRelease moves Unreleased into a dated section and adds the compare links', () => {
  const cut = cutRelease(LOG, '0.2.0', '2026-11-10', REPO);
  assert.match(
    cut,
    /## \[Unreleased\]\n\n## \[0\.2\.0\] - 2026-11-10\n\n### Added\n\n- A thing\.\n\n## \[0\.1\.0\]/,
  );
  assert.ok(cut.includes(`[Unreleased]: ${REPO}/compare/v0.2.0...HEAD\n`));
  assert.ok(cut.includes(`[0.2.0]: ${REPO}/compare/v0.1.0...v0.2.0\n`));
  assert.ok(cut.includes(`[0.1.0]: ${REPO}/releases/tag/v0.1.0\n`));
});

test('cutRelease replaces an earlier Unreleased link', () => {
  const once = cutRelease(LOG, '0.2.0', '2026-11-10', REPO);
  const twice = cutRelease(
    once.replace('## [Unreleased]\n', '## [Unreleased]\n\n- More.\n'),
    '0.3.0',
    '2026-11-11',
    REPO,
  );
  assert.equal(twice.match(/^\[Unreleased\]:/gm).length, 1);
  assert.ok(twice.includes(`[Unreleased]: ${REPO}/compare/v0.3.0...HEAD\n`));
  assert.ok(twice.includes(`[0.3.0]: ${REPO}/compare/v0.2.0...v0.3.0\n`));
});

test('cutRelease refuses an empty Unreleased', () => {
  assert.throws(() => cutRelease(EMPTY, '0.2.0', '2026-11-10', REPO), /Unreleased is empty/);
});

test('releaseNotes returns one version, and fails for an unknown one', () => {
  const cut = cutRelease(LOG, '0.2.0', '2026-11-10', REPO);
  assert.equal(releaseNotes(cut, '0.2.0'), '### Added\n\n- A thing.');
  assert.equal(releaseNotes(cut, '0.1.0'), '### Added\n\n- First.');
  assert.throws(() => releaseNotes(cut, '9.9.9'), /no section for 9\.9\.9/);
});

test('needsChangelog looks only at product code', () => {
  assert.equal(needsChangelog(['apps/api/src/main.ts']), true);
  assert.equal(needsChangelog(['docs/x.md', 'packages/ui/src/a.ts']), true);
  assert.equal(needsChangelog(['infra/Caddyfile']), true);
  assert.equal(needsChangelog(['docs/x.md', 'README.md', '.github/workflows/ci.yml']), false);
});

test('addsToUnreleased needs a new line under Unreleased', () => {
  assert.equal(addsToUnreleased(LOG, LOG.replace('- A thing.', '- A thing.\n- Another.')), true);
  assert.equal(addsToUnreleased(LOG, LOG), false);
  assert.equal(addsToUnreleased(LOG, LOG.replace('- First.', '- First.\n- Sneaked.')), false);
});
