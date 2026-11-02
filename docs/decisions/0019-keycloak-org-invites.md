# ADR-0019: Invites through Keycloak organization invites

Status: Accepted · Date: 2026-11-02

## Context

Admins invite people by email with a role. Keycloak 26 can invite to an organization and email a link that registers or signs in the person and adds them to the organization. It does not know our roles.

## Decision

- `POST /api/members/invites` stores `(email, role)` in `tenant_invites`, then calls Keycloak's `invite-user`, both inside one transaction. If Keycloak refuses, the row is rolled back. One open invite per email per tenant, case-insensitive.
- The person follows the email link and joins the organization in no group.
- Their first request to the tenant reaches the guard with `organization.<slug>.groups = []`. The invite claimer looks up the open invite by the token's email, moves them into that role's group, marks the invite accepted and audits `member.joined`, all before the request continues.
- With no open invite, a member with no group gets 403.

## Alternatives considered

- Our own signed invite links and emails: more control over the email and expiry, more code to own.

## Consequences

- Keycloak owns the invite link, its expiry and the email template.
- The role applies on the first request, not at the moment of joining. Until then, the person is in the organization with no access.
