// pnpm release <version>: cuts the changelog, sets the version, commits and tags (ADR-0030). You push.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { cutRelease, isHigher, parseVersion } from './lib/changelog.mjs';

const REPO = 'https://github.com/mfurqanwork/tenantry-keycloak-multitenancy';
const file = (name) => new URL(`../${name}`, import.meta.url);
const git = (...args) =>
  execFileSync('git', args, { cwd: file(''), encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const version = process.argv[2] ?? '';
if (!parseVersion(version)) fail('Usage: pnpm release <x.y.z>');
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('Release from main.');
if (git('status', '--porcelain')) fail('Commit or stash your changes first.');

const pkg = JSON.parse(readFileSync(file('package.json'), 'utf8'));
if (!isHigher(version, pkg.version)) fail(`${version} is not higher than ${pkg.version}.`);

const date = new Date().toISOString().slice(0, 10);
let changelog;
try {
  changelog = cutRelease(readFileSync(file('CHANGELOG.md'), 'utf8'), version, date, REPO);
} catch (err) {
  fail(err.message);
}
writeFileSync(file('CHANGELOG.md'), changelog);
pkg.version = version;
writeFileSync(file('package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

git('add', 'CHANGELOG.md', 'package.json');
git('commit', '-m', `chore: release ${version}`);
git('tag', '-a', `v${version}`, '-m', `Tenantry ${version}`);
console.log(`Tagged v${version}. Push it with:\n  git push origin main v${version}`);
