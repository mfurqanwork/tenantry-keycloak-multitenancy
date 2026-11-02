# ADR-0019: Invites through Keycloak organization invites

Status: Accepted · Date: 2026-11-02

## Context

Admins invite people by email with a role. Keycloak 26 can invite to an organization and email a link that registers or signs in the person and adds them to the organization. It does not know our roles.

## Decision

- `POST /api/members/invites` stores `(email, role)` in `tenant_invites`, then calls Keycloak's `invite-user`, both inside one transaction. If Keycloak refuses, the row is rolled back. One open invite per email per tenant, case-insensitive.
- The person follows the email link and joins the organization in no group.
- Their first request to the tenant reaches the guard with `organization.<slug>.groups = []`. The invite claimer looks up the open invite by the token's email, moves them into that role's group, marks the invite accepted and audits `member.joined`, all before the request continues.
- Only a verified email (`email_verified` in the token; the realm sets `verifyEmail`) can claim an invite.
- The invite row is locked while it is claimed, so parallel first requests apply it once.
- With no open invite, the claimer reads the member's current group from Keycloak. A role applied a moment ago therefore holds while the person's token still shows no group (tokens live five minutes).
- Keycloak 26.8 offers no way to withdraw a sent invitation. If someone joins through a revoked invite, the claimer takes them back out of the organization and audits it.
- With no invite and no group, the request gets 403.

## Alternatives considered

- Our own signed invite links and emails: more control over the email and expiry, more code to own.

## Consequences

- Keycloak owns the invite link, its expiry and the email template.
- The role applies on the first request, not at the moment of joining. Until then, the person is in the organization with no access.
