# ADR-0028: Notifications read from the audit log

Status: Accepted · Date: 2026-11-08

## Context

People need to hear about what changes in their workspace without opening the audit log: someone joined, their role changed, the security settings changed, a directory sync token is about to stop working, another workspace invited them. Every identity change already writes an audit entry in the same transaction as the change (AGENTS.md rule 5).

## Decision

- **Notifications are the audit log, read for one person.** `GET /api/notifications` reads the workspace's audit entries of the last 30 days for a fixed list of actions, then keeps the ones this reader may see:
  - **about you** (anyone): your role changed, console access given or taken;
  - **team and workspace** (owners and admins, `members:invite`): people joining, leaving, removed, added or turned off by the directory; branding, customer apps, the move to Enterprise;
  - **security** (owners, `tenant:settings`): security settings, directory sync tokens, company logins.

  Your own actions are left out. At most 30 are returned, newest first.

- **Worked out when read:** a directory sync token that expires within 14 days (owners).
- **Read state:** `notification_reads (tenant_id, user_id, read_until)`, a tenant table with forced row-level security. `POST /api/notifications/read` moves it forward, never back. An item is unread when it is newer.
- **Invites to other workspaces.** An invite lives in the inviting workspace's rows, which row-level security hides from every other workspace. A `security definer` function, `open_invites_for_email(email)`, returns the slug, name, role and sending time of active workspaces' open invites to exactly that email (compared lower-cased), and nothing else. The time lets "Mark all as read" count an invite as read like any other notification.
  - The function runs as the table owner. Forced row-level security binds the owner too, so `tenant_invites` gets one extra read-only policy for `tenantry_owner`. The app role never runs as the owner; only migrations and this function do.
  - `EXECUTE` is revoked from `PUBLIC` and granted to `tenantry_app` only.
  - The API calls it only with the email from the person's own token, and only when the token says `email_verified`.
  - It is the one read across workspaces outside the platform repository.
- **The bell** in both apps polls every 60 seconds while the page is visible.

## Alternatives considered

- **A notifications table written on every action:** a second write in every identity change, a fan-out to each recipient (whose roles live in Keycloak), and a second record that could disagree with the audit log.
- **Keycloak organization invitations** for cross-workspace invites: Keycloak 26.8 has no per-user list of open invitations, and enterprise realms are separate.
- **Server-sent events or websockets:** live updates for a list that changes a few times a day; polling is enough and stays behind the same guard.

## Consequences

- Nothing new is written when something happens; a notification is exactly as complete as its audit entry.
- A new audited action needs a rule before anyone hears about it.
- Notifications older than 30 days drop out, while the audit log keeps them.
- Isolation tests: another workspace's events never appear; a member never sees team, workspace or security events; another workspace's invite reaches only its verified address.
