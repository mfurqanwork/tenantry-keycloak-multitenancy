// Inside the ops image, on each deploy (ADR-0029): the account the API creates enterprise realms with, then
// the demo. The password-grant client is on only while the seed runs.
import { execFileSync } from 'node:child_process';
import { ensureProvisionerClient, setClientEnabled } from './lib/provisioner.mjs';

const need = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
};
const admin = {
  baseUrl: need('TENANTRY_AUTH_INTERNAL_URL'),
  adminUser: need('KC_BOOTSTRAP_ADMIN_USERNAME'),
  adminPassword: need('KC_BOOTSTRAP_ADMIN_PASSWORD'),
};
const seedClient = (enabled) => setClientEnabled({ ...admin, clientId: 'tenantry-isolation-tests', enabled });

await ensureProvisionerClient({
  ...admin,
  clientId: need('KEYCLOAK_PROVISIONER_CLIENT_ID'),
  secret: need('KEYCLOAK_PROVISIONER_CLIENT_SECRET'),
});
await seedClient(true);
try {
  execFileSync('node', ['--import', 'tsx', 'src/cli.ts', 'seed'], { cwd: 'apps/ops', stdio: 'inherit' });
} finally {
  await seedClient(false);
}
