import type { ExitCode } from '../deps.js';
import type { EnterpriseDeps } from './enterprise.js';

// Customer apps of an enterprise tenant (ADR-0011), through the API's operator routes. People register
// apps in the portal; these are for operators and the seed.
export interface OpsAppInput {
  name: string;
  type: string;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
}

export interface OpsApp {
  id: string;
  clientId: string;
  name: string;
  type: string;
  connection: { issuer: string };
}

interface Problem {
  detail?: string;
}

type Deps = Pick<EnterpriseDeps, 'api' | 'operatorToken' | 'baseDomain'>;

const path = (tenant: string) => `/api/platform/enterprise-tenants/${encodeURIComponent(tenant)}/apps`;
const reason = (res: { status: number; body: unknown }) =>
  (res.body as Problem | undefined)?.detail ?? `The API answered ${String(res.status)}.`;

export async function listOpsApps(deps: Deps, tenant: string): Promise<OpsApp[]> {
  const res = await deps.api(deps.baseDomain, 'GET', path(tenant), { token: await deps.operatorToken() });
  if (res.status !== 200) throw new Error(reason(res));
  return (res.body as { apps: OpsApp[] }).apps;
}

export async function registerOpsApp(
  deps: Deps,
  tenant: string,
  input: OpsAppInput,
): Promise<{ app: OpsApp; clientSecret?: string }> {
  const res = await deps.api(deps.baseDomain, 'POST', path(tenant), {
    token: await deps.operatorToken(),
    body: input,
  });
  if (res.status !== 201) throw new Error(reason(res));
  return res.body as { app: OpsApp; clientSecret?: string };
}

export async function rotateOpsApp(deps: Deps, tenant: string, appId: string): Promise<string> {
  const res = await deps.api(deps.baseDomain, 'POST', `${path(tenant)}/${encodeURIComponent(appId)}/secret`, {
    token: await deps.operatorToken(),
  });
  if (res.status !== 200) throw new Error(reason(res));
  return (res.body as { clientSecret: string }).clientSecret;
}

async function report(deps: EnterpriseDeps, run: () => Promise<void>): Promise<ExitCode> {
  try {
    await run();
    return 0;
  } catch (err) {
    deps.err(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

export function listAppsCommand(deps: EnterpriseDeps, o: { tenant: string }): Promise<ExitCode> {
  return report(deps, async () => {
    const apps = await listOpsApps(deps, o.tenant);
    if (apps.length === 0) deps.out(`${o.tenant} has no apps.`);
    for (const a of apps) deps.out(`${a.id}  ${a.clientId}  ${a.type}  ${a.name}`);
  });
}

// The secret goes to standard output once; nothing keeps it.
export function registerAppCommand(
  deps: EnterpriseDeps,
  o: OpsAppInput & { tenant: string },
): Promise<ExitCode> {
  return report(deps, async () => {
    const { tenant, ...input } = o;
    const { app, clientSecret } = await registerOpsApp(deps, tenant, input);
    deps.out(`Registered ${app.name} as ${app.clientId} on ${tenant}.`);
    if (clientSecret) deps.out(`Client secret (shown once): ${clientSecret}`);
  });
}

export function rotateAppCommand(
  deps: EnterpriseDeps,
  o: { tenant: string; app: string },
): Promise<ExitCode> {
  return report(deps, async () => {
    const clientSecret = await rotateOpsApp(deps, o.tenant, o.app);
    deps.out(`New client secret for ${o.app} (shown once): ${clientSecret}`);
  });
}
