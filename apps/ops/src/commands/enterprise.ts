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

interface MigrationPlan {
  slug: string;
  realm: string;
  members: { email: string | null; role: string | null }[];
  invites: number;
  companyLogins: { alias: string; secretKept: boolean }[];
  cutOver?: boolean;
  waitingForSecret?: string[];
}

const refused = (deps: EnterpriseDeps, res: { status: number; body: unknown }): ExitCode => {
  deps.err((res.body as Problem | undefined)?.detail ?? `The API answered ${String(res.status)}.`);
  return 1;
};

// Moving a Standard workspace into its own realm (ADR-0025). A failed run is finished by running it again.
export async function migrateEnterprise(
  deps: EnterpriseDeps,
  input: { tenant: string; dryRun: boolean },
): Promise<ExitCode> {
  const res = await deps.api(deps.baseDomain, 'POST', '/api/platform/enterprise-tenants/migrate', {
    token: await deps.operatorToken(),
    body: { slug: input.tenant, dryRun: input.dryRun },
  });
  if (res.status !== 200) return refused(deps, res);
  const p = res.body as MigrationPlan;
  if (input.dryRun) {
    deps.out(`${p.slug} would move to ${p.realm} (dry run, nothing changed).`);
    for (const m of p.members) deps.out(`  ${m.email ?? '(no email)'}: ${m.role ?? 'no role'}`);
    deps.out(`  ${String(p.invites)} open invite${p.invites === 1 ? '' : 's'}, sent again from ${p.realm}`);
    for (const c of p.companyLogins) {
      deps.out(
        `  company login ${c.alias}: ${c.secretKept ? 'copied with its kept secret' : 'no kept secret, copied switched off'}`,
      );
    }
    return 0;
  }
  deps.out(
    `${p.slug} now signs in through ${p.realm}. People use "Continue with your Tenantry account" the first time.`,
  );
  for (const alias of p.waitingForSecret ?? []) {
    deps.out(
      `  ${alias} is copied but off: IDP_CLIENT_SECRET=... pnpm ops enterprise idp-secret --tenant ${p.slug} --alias ${alias}`,
    );
  }
  deps.out(`When everyone has signed in: pnpm ops enterprise migrate --tenant ${p.slug} --finish`);
  return 0;
}

export async function finishMigration(deps: EnterpriseDeps, input: { tenant: string }): Promise<ExitCode> {
  const res = await deps.api(deps.baseDomain, 'POST', '/api/platform/enterprise-tenants/migrate/finish', {
    token: await deps.operatorToken(),
    body: { slug: input.tenant },
  });
  if (res.status !== 204) return refused(deps, res);
  deps.out(`${input.tenant}: the bridge is gone and its organization removed from the shared realm.`);
  return 0;
}

export async function abortMigration(deps: EnterpriseDeps, input: { tenant: string }): Promise<ExitCode> {
  const res = await deps.api(deps.baseDomain, 'POST', '/api/platform/enterprise-tenants/migrate/abort', {
    token: await deps.operatorToken(),
    body: { slug: input.tenant },
  });
  if (res.status !== 204) return refused(deps, res);
  deps.out(`${input.tenant} is a Standard workspace again; its half-built realm is gone.`);
  return 0;
}

// The secret comes from an environment variable (secretFrom), never the command line.
export async function setIdpSecretCommand(
  deps: EnterpriseDeps,
  input: { tenant: string; alias: string; secret: string },
): Promise<ExitCode> {
  const res = await deps.api(
    deps.baseDomain,
    'PUT',
    `/api/platform/enterprise-tenants/${encodeURIComponent(input.tenant)}/idps/${encodeURIComponent(input.alias)}/secret`,
    { token: await deps.operatorToken(), body: { secret: input.secret } },
  );
  if (res.status !== 204) return refused(deps, res);
  deps.out(`${input.alias} signs people in again, in ${input.tenant}'s own realm.`);
  return 0;
}
