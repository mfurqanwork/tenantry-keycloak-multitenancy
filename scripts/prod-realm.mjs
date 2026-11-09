// Writes the production realms for the Keycloak image. Usage: node scripts/prod-realm.mjs <base domain> <out dir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { productionRealms } from './lib/prod-realm.mjs';

const [baseDomain, out] = process.argv.slice(2);
if (!baseDomain || !out) {
  console.error('Usage: node scripts/prod-realm.mjs <base domain> <out dir>');
  process.exit(1);
}
const read = (name) => JSON.parse(readFileSync(new URL(`../infra/keycloak/${name}`, import.meta.url), 'utf8'));
const { platform, corp } = productionRealms({
  platform: read('platform-realm.json'),
  corp: read('corp-demo-realm.json'),
  baseDomain,
});
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'platform-realm.json'), JSON.stringify(platform, null, 2));
writeFileSync(join(out, 'corp-demo-realm.json'), JSON.stringify(corp, null, 2));
