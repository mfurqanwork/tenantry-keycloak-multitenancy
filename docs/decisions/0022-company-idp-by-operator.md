# ADR-0022: Company login is linked by an operator, after a DNS proof

Status: Accepted · Date: 2026-11-03

## Context

A company wants its people to sign in to its workspace with its own identity provider (Entra ID, Okta and the like). Keycloak organizations can send everyone with an email at a domain to the identity provider linked to that domain. Whoever controls that link controls who can sign in as `@acme.com`, so a workspace must prove it owns the domain before the link exists.

## Decision

- Linking is an operator task, run with `pnpm ops` (the `apps/ops` command line), not a page in the portal yet.
- Three steps:
  1. `domain claim` stores a random 32-byte token (base64url) and prints the record to create: `_tenantry-verify.<domain> TXT "tenantry-verify=<token>"`.
  2. `domain verify` looks the record up (through `TENANTRY_DNS_SERVER`, or the system resolver when it is unset). On a match it marks the domain verified.
  3. `idp link` refuses unless the domain is verified for that workspace. It then creates the OIDC identity provider from the issuer's discovery document, adds the domain to the organization, links the provider, and sets that domain's `identityProviderAlias` with `autoRedirect` (Keycloak 26.8 keeps this on the organization's domain).
- Only one workspace can verify a domain: a unique index on verified domains sees every workspace's rows.
- An identity provider alias belongs to one workspace (`tenant_idps.alias` is unique). The row is written in the same transaction as the Keycloak calls. If Keycloak fails, the row is rolled back and a provider created in that run is deleted.
- The scripts use their own Keycloak service account, `tenantry-ops`, which may manage identity providers. The API's account, `tenantry-backend`, may not.
- The provider's client secret never goes on the command line: `--client-secret-env` names the environment variable (or `.env` entry) that holds it.
- Each step writes an audit entry (`domain.claimed`, `domain.verified`, `idp.linked`) with no user and `via: ops`.
- Locally, the realm `corp-demo` plays the company's identity provider, and a CoreDNS container on `127.0.0.1:1053` answers for `.test`. `pnpm ops dns set-txt` writes the record and tells CoreDNS to reload. A Windows bind mount does not show it the file change otherwise.

## Alternatives considered

- Self-service in the portal: friendlier, but it needs the same proof plus a page for the identity provider's secret. That is later work.
- An email to `admin@<domain>` as the proof: weaker than DNS, and the DNS step is the industry habit.

## Consequences

- People from a linked domain are added to the organization by Keycloak with no group. As with invites (ADR-0019), they get a role through an invite for their email, or an admin gives them one.
- Removing a link, and checking the TXT record again later, are not built yet (docs/known-issues.md).
