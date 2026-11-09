// CI, on a version tag: the tag, package.json and the changelog agree. Prints the release notes.
// Usage: node scripts/verify-release.mjs v1.2.3
import { readFileSync } from 'node:fs';
import { parseVersion, releaseNotes } from './lib/changelog.mjs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const tag = process.argv[2] ?? '';
const version = tag.replace(/^v/, '');
if (!tag.startsWith('v') || !parseVersion(version)) fail(`Not a version tag: ${tag}`);
const inPackage = JSON.parse(read('package.json')).version;
if (inPackage !== version) fail(`Tag ${tag} does not match package.json (${inPackage}).`);
try {
  console.log(releaseNotes(read('CHANGELOG.md'), version));
} catch (err) {
  fail(err.message);
}
