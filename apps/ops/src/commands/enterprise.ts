import type { ExitCode } from '../deps.js';
import type { ApiCall } from '../seed/http.js';

// Enterprise tenants are built by the API (ADR-0010); these commands call it as the operator client.
export interface EnterpriseDeps {
  api: ApiCall;
  // A tenantry-ops client-credentials token from the platform realm.
  operatorToken: () => Promise<string>;
  baseDomain: string;
  out: (line: string) => void;
  err: (line: string) => void;
}

interface Problem {
  detail?: string;
}
interface Provisioned {
  slug: string;
  realm: string;
  webUrl: string;
}
interface Upgraded {
  realm: string;
  applied: boolean;
  differences: { path: string; live: unknown; template: unknown }[];
  error?: string;
}

const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

export async function provisionEnterprise(
  deps: EnterpriseDeps,
  input: { slug: string; name: string; adminEmail: string },
): Promise<ExitCode> {
  const res = await deps.api(deps.baseDomain, 'POST', '/api/platform/enterprise-tenants', {
    token: await deps.operatorToken(),
    body: input,
  });
  if (res.status !== 201 && res.status !== 200) {
    deps.err((res.body as Problem | undefined)?.detail ?? `The API answered ${String(res.status)}.`);
    return 1;
  }
  const t = res.body as Provisioned;
  if (res.status === 200) {
    deps.out(`${t.slug} was already provisioned: ${t.webUrl} (realm ${t.realm}). Nothing changed.`);
  } else {
    deps.out(`${t.slug} is ready at ${t.webUrl} (realm ${t.realm}).`);
    deps.out(`${input.adminEmail} has an email to set a password and sign in as the owner.`);
  }
  return 0;
}

export async function upgradeEnterprise(
  deps: EnterpriseDeps,
  input: { tenant?: string; dryRun: boolean },
): Promise<ExitCode> {
  const res = await deps.api(deps.baseDomain, 'POST', '/api/platform/enterprise-tenants/upgrade', {
    token: await deps.operatorToken(),
    body: { ...(input.tenant ? { slug: input.tenant } : {}), dryRun: input.dryRun },
  });
  if (res.status !== 200) {
    deps.err((res.body as Problem | undefined)?.detail ?? `The API answered ${String(res.status)}.`);
    return 1;
  }
  let code: ExitCode = 0;
  for (const r of res.body as Upgraded[]) {
    if (r.error !== undefined) {
      deps.err(`${r.realm}: could not be read (${r.error}). Nothing changed in it.`);
      code = 1;
      continue;
    }
    if (r.differences.length === 0) {
      deps.out(`${r.realm}: up to date${r.applied ? ' (template version recorded)' : ''}.`);
      continue;
    }
    const count = `${String(r.differences.length)} difference${r.differences.length === 1 ? '' : 's'}`;
    deps.out(`${r.realm}: ${count} ${r.applied ? '(applied)' : '(dry run, nothing changed)'}`);
    for (const d of r.differences) deps.out(`  ${d.path}: ${show(d.live)} → ${show(d.template)}`);
  }
  return code;
}
