// CI, on a pull request: product code changed, so Unreleased must have a new line (ADR-0030).
// Usage: node scripts/check-changelog.mjs <base commit>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { addsToUnreleased, needsChangelog } from './lib/changelog.mjs';

const root = new URL('../', import.meta.url);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

const base = git('merge-base', process.argv[2] ?? 'origin/main', 'HEAD').trim();
const changed = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean);

if (!needsChangelog(changed)) {
  console.log('No product code changed: no changelog line needed.');
} else if (
  addsToUnreleased(git('show', `${base}:CHANGELOG.md`), readFileSync(new URL('CHANGELOG.md', root), 'utf8'))
) {
  console.log('CHANGELOG.md has a new line under Unreleased.');
} else {
  console.error(
    'This pull request changes apps/, packages/ or infra/. Add a line under Unreleased in CHANGELOG.md, or add the skip-changelog label if there is nothing to tell.',
  );
  process.exit(1);
}
