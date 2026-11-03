import { listOpsApps, registerOpsApp, rotateOpsApp, type OpsApp } from '../commands/apps.js';
import type { EnterpriseDeps } from '../commands/enterprise.js';

// The demo's customer app (Phase 4): examples/customer-app signs in to Initech through it.
export const EXAMPLE_APP = {
  tenant: 'initech',
  name: 'Initech HR',
  redirectUri: 'http://127.0.0.1:4000/callback',
  postLogoutRedirectUri: 'http://127.0.0.1:4000/',
} as const;

export interface ExampleAppDeps extends Pick<EnterpriseDeps, 'api' | 'operatorToken' | 'baseDomain'> {
  // Where the example app reaches Keycloak from the host (Node cannot resolve *.localhost everywhere).
  authInternalUrl: string;
  // examples/customer-app/.env: git-ignored, written by this host process, read by the example app.
  envFile: { read(): string | null; write(text: string): void };
}

function settings(deps: ExampleAppDeps, app: OpsApp, clientSecret: string): string {
  return [
    '# Written by pnpm seed for examples/customer-app. Git ignores this file; it holds a secret.',
    `ISSUER=${app.connection.issuer}`,
    `CLIENT_ID=${app.clientId}`,
    `CLIENT_SECRET=${clientSecret}`,
    `AUTH_INTERNAL_URL=${deps.authInternalUrl}`,
    '',
  ].join('\n');
}

// Registers the app once. Its secret cannot be read back, so a missing settings file means a new secret.
// Returns what changed, never the secret.
export async function ensureExampleApp(deps: ExampleAppDeps): Promise<string | null> {
  const found = (await listOpsApps(deps, EXAMPLE_APP.tenant)).find((a) => a.name === EXAMPLE_APP.name);
  if (!found) {
    const { app, clientSecret } = await registerOpsApp(deps, EXAMPLE_APP.tenant, {
      name: EXAMPLE_APP.name,
      type: 'web',
      redirectUris: [EXAMPLE_APP.redirectUri],
      postLogoutRedirectUris: [EXAMPLE_APP.postLogoutRedirectUri],
    });
    if (!clientSecret) throw new Error(`${EXAMPLE_APP.name} came back without a secret`);
    deps.envFile.write(settings(deps, app, clientSecret));
    return `example app ${EXAMPLE_APP.name}`;
  }
  if (deps.envFile.read()?.includes(`CLIENT_ID=${found.clientId}\n`)) return null;
  deps.envFile.write(settings(deps, found, await rotateOpsApp(deps, EXAMPLE_APP.tenant, found.id)));
  return 'example app secret';
}
