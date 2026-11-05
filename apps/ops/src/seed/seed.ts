import {
  findDomain,
  insertAudit,
  listIdps,
  platformRepository,
  putLogo,
  tenantTx,
  type TenantRecord,
} from '@tenantry/db';
import { TEMPLATE_VERSION } from '@tenantry/keycloak-admin';
import type { DevUsers } from '@tenantry/keycloak-admin/dev';
import { claimDomain, verifyDomain } from '../commands/domain.js';
import { provisionEnterprise, upgradeEnterprise } from '../commands/enterprise.js';
import { linkIdp } from '../commands/idp.js';
import type { OpsDeps } from '../deps.js';
import { verificationRecord } from '../dns/txt.js';
import type { ApiCall } from './http.js';
import { ensureExampleApp, type ExampleAppDeps } from './example-app.js';
import { solidPng } from './png.js';

type Group = 'owners' | 'admins' | 'members';

interface Person {
  email: string;
  firstName: string;
  lastName: string;
  workspaces: Record<string, Group>;
}

// The demo (docs/demo-script.md). Local test accounts only, all with SEED_PASSWORD.
export const WORKSPACES = [
  { slug: 'acme', name: 'Acme', color: '#0f62fe', owner: 'ada@example.test' },
  { slug: 'globex', name: 'Globex', color: '#198038', owner: 'gil@example.test' },
] as const;

export const PEOPLE: Person[] = [
  { email: 'ada@example.test', firstName: 'Ada', lastName: 'Acme', workspaces: { acme: 'owners' } },
  { email: 'ben@example.test', firstName: 'Ben', lastName: 'Acme', workspaces: { acme: 'admins' } },
  { email: 'cy@example.test', firstName: 'Cy', lastName: 'Acme', workspaces: { acme: 'members' } },
  { email: 'gil@example.test', firstName: 'Gil', lastName: 'Globex', workspaces: { globex: 'owners' } },
  { email: 'gwen@example.test', firstName: 'Gwen', lastName: 'Globex', workspaces: { globex: 'admins' } },
  { email: 'gus@example.test', firstName: 'Gus', lastName: 'Globex', workspaces: { globex: 'members' } },
  {
    email: 'pat@example.test',
    firstName: 'Pat',
    lastName: 'Both',
    workspaces: { acme: 'members', globex: 'members' },
  },
];

// The enterprise demo (Phase 3): its own realm, built through the API like any operator would.
export const ENTERPRISE = {
  slug: 'initech',
  name: 'Initech',
  owner: 'owner@initech.test',
  color: '#4d5358',
} as const;

// Company login for acme: people at acme.test sign in through the corp-demo realm (ADR-0022).
export const COMPANY = {
  tenant: 'acme',
  domain: 'acme.test',
  alias: 'acme-corp',
  person: 'alice@acme.test',
  // The name on the sign-in button (Phase 6a), instead of the alias.
  displayName: 'Acme Corp',
};

export interface SeedDeps extends OpsDeps {
  users: DevUsers;
  api: ApiCall;
  // A user's access token through the dev-only password-grant client, for one workspace or none.
  tokenFor: (email: string, slug?: string) => Promise<string>;
  password: string;
  baseDomain: string;
  company: { issuer: string; clientSecret: string };
  setTxt: (name: string, value: string) => void;
  // A tenantry-ops client-credentials token, for the operator-only enterprise endpoints.
  operatorToken: () => Promise<string>;
  // Where the example customer app reaches Keycloak, and its settings file (Phase 4).
  authInternalUrl: string;
  exampleAppEnv: ExampleAppDeps['envFile'];
}

// Creates or completes the demo; a second run changes nothing.
export async function seed(deps: SeedDeps): Promise<number> {
  const changes: string[] = [];
  const quiet = { ...deps, out: () => undefined };
  const platform = platformRepository(deps.db);

  for (const p of PEOPLE) {
    const { created } = await deps.users.ensureUser('platform', { ...p, password: deps.password });
    if (created) changes.push(`user ${p.email}`);
  }
  const alice = await deps.users.ensureUser('corp-demo', {
    email: COMPANY.person,
    firstName: 'Alice',
    lastName: 'Anders',
    password: deps.password,
  });
  if (alice.created) changes.push(`company user ${COMPANY.person}`);

  for (const w of WORKSPACES) {
    let tenant = await platform.findTenantBySlug(w.slug);
    if (tenant?.status !== 'active') {
      const res = await deps.api(deps.baseDomain, 'POST', '/api/signup', {
        token: await deps.tokenFor(w.owner),
        body: { name: w.name, slug: w.slug },
      });
      if (res.status !== 201)
        throw new Error(`signup ${w.slug}: ${String(res.status)} ${JSON.stringify(res.body)}`);
      changes.push(`workspace ${w.slug}`);
      tenant = await platform.findTenantBySlug(w.slug);
    }
    if (!tenant?.kcOrgId) throw new Error(`workspace ${w.slug} has no organization`);
    await ensureMembers(deps, tenant, changes);
    await ensureBranding(deps, tenant, w, changes);
  }

  const acme = await platform.findTenantBySlug(COMPANY.tenant);
  if (acme) await ensureCompanyLogin(deps, quiet, acme, changes);
  await ensureEnterprise(deps, changes);

  deps.out(
    changes.length ? `Seeded: ${changes.join(', ')}.` : 'The demo is already seeded: nothing to change.',
  );
  return 0;
}

async function ensureMembers(deps: SeedDeps, tenant: TenantRecord, changes: string[]) {
  const orgId = tenant.kcOrgId ?? '';
  const members = await deps.directory.listMembers(orgId);
  for (const p of PEOPLE) {
    const group = p.workspaces[tenant.slug];
    if (!group) continue;
    const { id } = await deps.users.ensureUser('platform', { ...p, password: deps.password });
    const current = members.find((m) => m.kcUserId === id);
    if (!current) await deps.directory.addMember(orgId, id);
    if (current?.group !== group) {
      await deps.directory.setMemberGroup(orgId, id, group);
      changes.push(`${p.email} in ${tenant.slug} as ${group}`);
    }
  }
}

async function ensureBranding(
  deps: SeedDeps,
  tenant: TenantRecord,
  w: (typeof WORKSPACES)[number],
  changes: string[],
) {
  const host = `${tenant.slug}.${deps.baseDomain}`;
  const token = await deps.tokenFor(w.owner, tenant.slug);
  if (tenant.branding.primaryColor !== w.color) {
    const res = await deps.api(host, 'PUT', '/api/branding', { token, body: { primaryColor: w.color } });
    if (res.status !== 200) throw new Error(`branding ${tenant.slug}: ${String(res.status)}`);
    changes.push(`${tenant.slug} colour`);
  }
  if (tenant.branding.logoVersion === null) {
    const boundary = 'tenantryseed';
    const raw = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="logo.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      solidPng(w.color),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await deps.api(host, 'POST', '/api/branding/logo', {
      token,
      raw,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    });
    if (res.status !== 201) throw new Error(`logo ${tenant.slug}: ${String(res.status)}`);
    changes.push(`${tenant.slug} logo`);
  }
}

async function ensureCompanyLogin(deps: SeedDeps, quiet: OpsDeps, acme: TenantRecord, changes: string[]) {
  const { tenant, domain, alias } = COMPANY;
  const linked = await tenantTx(deps.db, acme.id, (tx) => listIdps(tx));
  if (!linked.some((idp) => idp.alias === alias)) {
    await claimDomain(quiet, { tenant, domain });
    const claimed = await tenantTx(deps.db, acme.id, (tx) => findDomain(tx, domain));
    if (!claimed?.verifiedAt) {
      const record = verificationRecord(domain, claimed?.verificationToken ?? '');
      deps.setTxt(record.name, record.value);
      // CoreDNS answers once it has reloaded the zone; give it a moment.
      for (let i = 0; i < 10 && (await verifyDomain(quiet, { tenant, domain })) !== 0; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    const code = await linkIdp(deps, {
      tenant,
      domain,
      alias,
      issuer: deps.company.issuer,
      clientId: 'tenantry-platform',
      clientSecret: deps.company.clientSecret,
      displayName: COMPANY.displayName,
    });
    if (code !== 0) throw new Error(`could not link ${alias} to ${domain}`);
    changes.push(`company login for ${domain}`);
  } else if ((await quiet.directory.setIdentityProviderDisplayName(alias, COMPANY.displayName)).changed) {
    // A stack seeded before Phase 6a: its button showed the alias.
    changes.push(`company login button for ${domain}`);
  }
  // Alice gets the member role through an invite, claimed the first time she signs in (ADR-0019).
  const members = await deps.directory.listMembers(acme.kcOrgId ?? '');
  if (!members.some((m) => m.email === COMPANY.person)) {
    const res = await deps.api(`${acme.slug}.${deps.baseDomain}`, 'POST', '/api/members/invites', {
      token: await deps.tokenFor('ada@example.test', acme.slug),
      body: { email: COMPANY.person, role: 'member' },
    });
    if (res.status === 201) changes.push(`invite for ${COMPANY.person}`);
    else if (res.status !== 409) throw new Error(`invite ${COMPANY.person}: ${String(res.status)}`);
  }
}

async function ensureEnterprise(deps: SeedDeps, changes: string[]) {
  const platform = platformRepository(deps.db);
  const before = await platform.findTenantBySlug(ENTERPRISE.slug);
  if (before?.status !== 'active') {
    const code = await provisionEnterprise(
      {
        api: deps.api,
        operatorToken: deps.operatorToken,
        baseDomain: deps.baseDomain,
        out: () => undefined,
        err: deps.err,
      },
      { slug: ENTERPRISE.slug, name: ENTERPRISE.name, adminEmail: ENTERPRISE.owner },
    );
    if (code !== 0) throw new Error(`could not provision ${ENTERPRISE.slug}`);
    changes.push(`enterprise workspace ${ENTERPRISE.slug}`);
  }
  const operator = {
    api: deps.api,
    operatorToken: deps.operatorToken,
    baseDomain: deps.baseDomain,
    out: () => undefined,
    err: deps.err,
  };
  const tenant = await platform.findTenantBySlug(ENTERPRISE.slug);
  if (!tenant?.realm) throw new Error(`${ENTERPRISE.slug} has no realm`);
  // A realm built from an older template moves to this one, as an operator would move it.
  if (tenant.templateVersion !== TEMPLATE_VERSION) {
    if ((await upgradeEnterprise(operator, { tenant: ENTERPRISE.slug, dryRun: false })) !== 0) {
      throw new Error(`could not upgrade ${ENTERPRISE.slug}`);
    }
    changes.push(`${ENTERPRISE.slug} realm template ${String(TEMPLATE_VERSION)}`);
  }
  // The first owner signs in with the demo password instead of the set-password email.
  await deps.users.ensureUser(tenant.realm, {
    email: ENTERPRISE.owner,
    firstName: 'Olivia',
    lastName: 'Owner',
    password: deps.password,
  });
  // Brand it in the database directly: the realm allows no password grant for an owner token (ADR-0010).
  if (tenant.branding.primaryColor !== ENTERPRISE.color || tenant.branding.logoVersion === null) {
    await tenantTx(deps.db, tenant.id, async (tx) => {
      await putLogo(tx, { contentType: 'image/png', bytes: solidPng(ENTERPRISE.color) });
      await platformRepository(tx).setBranding(tenant.id, {
        primaryColor: ENTERPRISE.color,
        logoVersion: Date.now(),
      });
      await insertAudit(tx, {
        actorUserId: null,
        action: 'branding.updated',
        target: tenant.id,
        metadata: { via: 'ops', seed: true, to: ENTERPRISE.color },
      });
    });
    changes.push(`${ENTERPRISE.slug} colour and logo`);
  }
  const exampleApp = await ensureExampleApp({
    ...operator,
    authInternalUrl: deps.authInternalUrl,
    envFile: deps.exampleAppEnv,
  });
  if (exampleApp) changes.push(exampleApp);
}
