import { findDomain, insertAudit, insertIdp, listIdps, tenantTx } from '@tenantry/db';
import type { CompanyIdentityProvider } from '@tenantry/keycloak-admin';
import type { ExitCode, OpsDeps } from '../deps.js';
import { activeWorkspace, OPS } from './workspace.js';

class Refused extends Error {}

// Step 3 of company login (ADR-0022): link the company's OIDC identity provider to the workspace for a
// verified domain. People with that email domain are then sent to it to sign in.
export async function linkIdp(
  deps: OpsDeps,
  input: CompanyIdentityProvider & { tenant: string; domain: string },
): Promise<ExitCode> {
  const tenant = await activeWorkspace(deps, input.tenant);
  if (!tenant?.kcOrgId) return 1;
  const orgId = tenant.kcOrgId;
  const domain = input.domain.toLowerCase();
  const provider = {
    alias: input.alias,
    issuer: input.issuer,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  };
  // An object, so the flag set inside the transaction is not narrowed to its first value.
  const state = { created: false };
  try {
    // One transaction: the row is written first (the alias is unique across workspaces), Keycloak is
    // changed inside it, and a Keycloak failure rolls the row back.
    await tenantTx(deps.db, tenant.id, async (tx) => {
      const claimed = await findDomain(tx, domain);
      if (!claimed?.verifiedAt) {
        throw new Refused(`${domain} is not verified for ${tenant.slug}. Run: pnpm ops domain verify first.`);
      }
      const linked = (await listIdps(tx)).some((idp) => idp.alias === input.alias);
      if (!linked) {
        try {
          await tx.transaction((sp) =>
            insertIdp(sp as typeof tx, { alias: input.alias, domainId: claimed.id }),
          );
        } catch {
          throw new Refused(`The alias ${input.alias} is already used by another workspace.`);
        }
      }
      await deps.directory.addOrganizationDomain(orgId, domain);
      await deps.directory.createOidcIdentityProvider(provider);
      state.created = !linked;
      await deps.directory.linkIdentityProvider(orgId, input.alias, domain);
      if (!linked) {
        await insertAudit(tx, {
          ...OPS,
          action: 'idp.linked',
          target: input.alias,
          metadata: { ...OPS.metadata, domain, issuer: input.issuer },
        });
      }
    });
  } catch (err) {
    if (err instanceof Refused) {
      deps.err(err.message);
      return 1;
    }
    if (state.created) await deps.directory.deleteIdentityProvider(input.alias);
    throw err;
  }
  deps.out(`${input.alias} signs in ${domain} for ${tenant.slug}.`);
  return 0;
}
