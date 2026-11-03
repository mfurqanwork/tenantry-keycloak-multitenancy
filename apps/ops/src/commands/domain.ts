import {
  claimDomain as claim,
  DomainTakenError,
  findDomain,
  insertAudit,
  markDomainVerified,
  tenantTx,
} from '@tenantry/db';
import type { ExitCode, OpsDeps } from '../deps.js';
import { verificationRecord } from '../dns/txt.js';
import { activeWorkspace, OPS } from './workspace.js';

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// One spelling per domain: lower case, no trailing dot. Null for anything that is not a domain name
// of at least two labels (no scheme, wildcard, spaces or empty labels).
export function normaliseDomain(input: string): string | null {
  const name = input.trim().toLowerCase().replace(/\.$/, '');
  const labels = name.split('.');
  if (name.length > 253 || labels.length < 2) return null;
  return labels.every((label) => LABEL.test(label)) ? name : null;
}

// Step 1 of company login (ADR-0022): a workspace claims an email domain and gets the TXT record that
// proves it owns it. Claiming again shows the same record.
export async function claimDomain(
  deps: OpsDeps,
  input: { tenant: string; domain: string },
): Promise<ExitCode> {
  const tenant = await activeWorkspace(deps, input.tenant);
  if (!tenant) return 1;
  const domain = normaliseDomain(input.domain);
  if (!domain) {
    deps.err(`${input.domain} is not a domain name.`);
    return 1;
  }
  const record = await tenantTx(deps.db, tenant.id, async (tx) => {
    const existing = await findDomain(tx, domain);
    const claimed = existing ?? (await claim(tx, domain));
    if (!existing) {
      await insertAudit(tx, {
        ...OPS,
        action: 'domain.claimed',
        target: claimed.id,
        metadata: { ...OPS.metadata, domain },
      });
    }
    return claimed;
  });
  const { name, value } = verificationRecord(domain, record.verificationToken);
  deps.out(
    `Create this DNS record, then run: pnpm ops domain verify --tenant ${tenant.slug} --domain ${domain}`,
  );
  deps.out(`${name} TXT "${value}"`);
  return 0;
}

// Step 2: the TXT record must carry the token. Only one workspace can verify a domain.
export async function verifyDomain(
  deps: OpsDeps,
  input: { tenant: string; domain: string },
): Promise<ExitCode> {
  const tenant = await activeWorkspace(deps, input.tenant);
  if (!tenant) return 1;
  const domain = normaliseDomain(input.domain);
  if (!domain) {
    deps.err(`${input.domain} is not a domain name.`);
    return 1;
  }
  return tenantTx(deps.db, tenant.id, async (tx) => {
    const claimed = await findDomain(tx, domain);
    if (!claimed) {
      deps.err(`${domain} is not claimed by ${tenant.slug}. Run: pnpm ops domain claim first.`);
      return 1;
    }
    if (claimed.verifiedAt) {
      deps.out(`${domain} is already verified for ${tenant.slug}.`);
      return 0;
    }
    const { name, value } = verificationRecord(domain, claimed.verificationToken);
    if (!(await deps.resolveTxt(name)).includes(value)) {
      deps.err(`The TXT record ${name} with ${value} was not found.`);
      return 1;
    }
    try {
      await markDomainVerified(tx, claimed.id);
    } catch (err) {
      if (err instanceof DomainTakenError) {
        deps.err(`${domain} is already verified by another workspace.`);
        return 1;
      }
      throw err;
    }
    await insertAudit(tx, {
      ...OPS,
      action: 'domain.verified',
      target: claimed.id,
      metadata: { ...OPS.metadata, domain },
    });
    deps.out(`${domain} is verified for ${tenant.slug}.`);
    return 0;
  });
}
