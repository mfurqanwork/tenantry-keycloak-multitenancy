import { findDomain, insertAudit, insertIdp, isUniqueViolation, listIdps, tenantTx } from '@tenantry/db';
import { idpSecretKey, type CompanyIdentityProvider } from '@tenantry/keycloak-admin';
import type { ExitCode, OpsDeps } from '../deps.js';
import { normaliseDomain } from './domain.js';
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
  const domain = normaliseDomain(input.domain);
  if (!domain) {
    deps.err(`${input.domain} is not a domain name.`);
    return 1;
  }
  // The name on the sign-in button (Phase 6a): the operator's, or the workspace's own.
  const displayName = input.displayName ?? `${tenant.name} company sign-in`;
  const provider = {
    alias: input.alias,
    issuer: input.issuer,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    displayName,
  };
  // An object, so the flags set inside the transaction are not narrowed to their first values.
  const state = { created: false, alreadyLinked: false, renamed: false };
  try {
    // One transaction: the row is written first (the alias is unique across workspaces), Keycloak is
    // changed inside it, and a Keycloak failure rolls the row back.
    await tenantTx(deps.db, tenant.id, async (tx) => {
      const claimed = await findDomain(tx, domain);
      if (!claimed?.verifiedAt) {
        throw new Refused(`${domain} is not verified for ${tenant.slug}. Run: pnpm ops domain verify first.`);
      }
      state.alreadyLinked = (await listIdps(tx)).some((idp) => idp.alias === input.alias);
      if (!state.alreadyLinked) {
        try {
          await tx.transaction((sp) =>
            insertIdp(sp as typeof tx, { alias: input.alias, domainId: claimed.id }),
          );
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new Refused(`The alias ${input.alias} is already used by another workspace.`);
          }
          throw err;
        }
      }
      const { created } = await deps.directory.createOidcIdentityProvider(provider);
      state.created = created;
      // A provider this workspace never linked (set up by hand, or left behind): never take it over.
      if (!created && !state.alreadyLinked) {
        throw new Refused(
          `An identity provider ${input.alias} already exists in Keycloak and is not this workspace's. Choose another alias.`,
        );
      }
      // A provider linked before it had a name, or renamed by the operator; a rerun with the same name
      // changes nothing.
      if (
        !created &&
        (input.displayName || !(await deps.directory.getIdentityProvider(input.alias))?.displayName)
      ) {
        state.renamed = (
          await deps.directory.setIdentityProviderDisplayName(input.alias, displayName)
        ).changed;
      }
      await deps.directory.addOrganizationDomain(orgId, domain);
      await deps.directory.linkIdentityProvider(orgId, input.alias, domain);
      if (!state.alreadyLinked) {
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
    // Undo only what this run made.
    if (state.created) await deps.directory.deleteIdentityProvider(input.alias);
    throw err;
  }
  // The secret, kept for a move to Enterprise (ADR-0025): never in Postgres, logs or audit. Kept when
  // this run gave it to Keycloak, or for a link made before any was kept; a rerun leaves Keycloak's
  // settings as they were, so it leaves the kept secret alone too.
  const key = idpSecretKey(input.alias);
  if (state.created || !(await deps.secrets.get(key))) await deps.secrets.put(key, input.clientSecret);
  deps.out(
    !state.alreadyLinked
      ? `${input.alias} signs in ${domain} for ${tenant.slug}, as "${displayName}".`
      : state.renamed
        ? `${input.alias} is already linked to ${domain} for ${tenant.slug}; its sign-in button now shows "${displayName}".`
        : `${input.alias} is already linked to ${domain} for ${tenant.slug}; nothing changed, and its settings stay as they were.`,
  );
  return 0;
}
