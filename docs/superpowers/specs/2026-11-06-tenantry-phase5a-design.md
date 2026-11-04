# Tenantry — Phase 5a design: SCIM and security settings

Date: 2026-11-06 · Status: draft for review

## Purpose

Phase 5 is split in two. **5a** (this spec) lets an enterprise workspace keep its people in step with its company directory through SCIM, and lets its owners set their realm's sign-in rules: two-step sign-in, passwords, session lengths and lockout. **5b** (its own spec) moves a Standard workspace to Enterprise and gives a customer's IT scoped access to their realm's console.

The domain design comes from the project plan doc ("Phase 5", the tier table) and ADRs 0001, 0010 and 0023. This spec records the choices those leave open. What does not work yet stays in `docs/known-issues.md`.

## What Keycloak 26.8.1 does (probed on throwaway realms)

- Native SCIM (`SCIM_API`, on by default) answers at `/realms/<realm>/scim/v2/…` once the realm's `scimApiEnabled` is true. It accepts a realm token whose audience is `<issuer>/scim/v2`, from a client holding `manage-users`, `view-users`, `query-users` and `query-groups`.
- Setting a client's `notBefore` makes Keycloak refuse its older tokens at once.
- A client's token cannot outlive the realm's SSO session limit (the template sets 10 h), so Keycloak cannot issue the long-lived token a directory needs.
- Fine-grained admin permissions v2 are on (`adminPermissionsEnabled` per realm); 5b uses them.

## Decisions taken for this phase

| Topic                   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who may use it          | Enterprise workspaces only. A Standard workspace gets 404 "Security settings and SCIM are available on Enterprise workspaces." on the API, and that sentence in the portal. Both pages need `tenant:settings` (owners).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| SCIM gateway            | Tenantry serves `https://<slug>.<base>/scim/v2/…` (Users, Groups, ServiceProviderConfig, Schemas, ResourceTypes). It checks a Tenantry SCIM token, then forwards the call to the realm's native SCIM with a short-lived token of a per-realm `tenantry-scim` client (client credentials, 5-minute tokens, cached until a minute before expiry; its secret in the secrets store, ADR-0023). Keycloak's status and body come back as they are, with `meta.location` and `Location` rewritten to the gateway's address. ADR-0024.                                                                                                                                                                                  |
| SCIM token              | `tnt_scim_` + 32 random bytes (base64url), shown once. Stored as a SHA-256 hash in `tenant_scim_tokens` (forced RLS) with its expiry (90 days, 180 days or 1 year), creation, last use (updated at most once a minute) and revocation. One active token per workspace: generating one revokes the previous. Revoking takes effect on the next call.                                                                                                                                                                                                                                                                                                                                                             |
| Turning SCIM on and off | The first token sets the realm's `scimApiEnabled`, creates `tenantry-scim` (if missing) and keeps the default role. Revoking the last active token sets `scimApiEnabled` false.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Gateway trust           | `/scim` routes use their own `ScimTokenGuard`, never `TenantAuthGuard`: a person's token never works on `/scim`, a SCIM token never works on `/api`. The host picks the tenant; the token is looked up only inside that tenant (`tenantTx`). Missing, wrong, revoked or expired → 401; Standard, unknown or inactive workspace → 404; Keycloak unreachable → 502; all as SCIM error bodies (`urn:ietf:params:scim:api:messages:2.0:Error`). Bodies over 1 MB → 413.                                                                                                                                                                                                                                             |
| Roles for SCIM people   | A default role per workspace: `member` or none (then an invite or an admin gives one). After Keycloak accepts a create, a PUT, or a PATCH of an active person, the gateway makes sure they hold it (idempotent; a failure is logged and audited and retried on the next such call). Groups `tenantry-members` and `tenantry-admins` exist in every realm with client-role mappings to `tenantry-api` `member` and `admin`; being in one gives the role, leaving takes it back. A directory "create" of those names matches the existing group; a DELETE of either empties it instead, keeping the mapping. Owners are never managed by SCIM. Deactivating a person in the directory disables them in the realm. |
| Members page            | Lists people who hold a role through a mapped group as well as by a direct grant; the higher role wins.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| SCIM audit              | `scim.token_created`, `scim.token_revoked` (expiry only, never the token), `scim.user_created`, `scim.user_updated`, `scim.user_deactivated`, `scim.group_changed`, `scim.role_grant_failed`, actor `null` with `via: 'scim'`. Target is the Keycloak id; no person's attributes in the metadata.                                                                                                                                                                                                                                                                                                                                                                                                               |
| Security settings       | One schema in `@tenantry/auth`, shared by API and portal. Two-step: `off`, `optional`, `required`. Passwords: minimum length 12–64, history 0–24, expiry 0–365 days (0 = never). Sessions: idle 15 min–12 h, maximum 1–24 h, idle ≤ maximum. Lockout: 3–20 failures, wait 1–60 minutes. Defaults are the template's current values.                                                                                                                                                                                                                                                                                                                                                                             |
| Saving settings         | One transaction: upsert `tenant_security` (forced RLS), apply to the realm through the `tenantry-provisioner` account (it administers the realms it created; `tenantry-backend` does not gain `manage-realm`), audit `security.updated` with before and after. A Keycloak refusal rolls the row back (422 with its reason, or 502).                                                                                                                                                                                                                                                                                                                                                                             |
| Realm template v3       | Adds a browser flow whose second step is a subflow of alternatives (TOTP form, WebAuthn, recovery codes), recovery codes enabled, and the two mapped groups. Two-step `off` / `optional` / `required` set that subflow to disabled / conditional (only if the person has one) / required (set one up at next sign-in). If Keycloak 26.8.1 cannot make "required, any of the three" work, required falls back to TOTP and passkeys stay optional; recorded in known issues. Existing realms move with `ops enterprise upgrade`, which the seed runs.                                                                                                                                                             |
| Upgrades and drift      | `upgrade` merges each tenant's `tenant_security` over the template defaults before comparing, so a tenant's choices are never drift and a console edit to those keys is.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Out of 5a               | Standard → Enterprise migration and scoped console access (5b); SCIM for Standard workspaces or for customer apps' users; gateway rate limits (Phase 6); custom attributes beyond Keycloak's SCIM mapping; per-person two-step exceptions; the company-login fold-ins (5b).                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## Exit criteria

1. An owner of Initech generates a SCIM token in the portal, and a SCIM client (curl in the guide) creates, updates and deactivates a person, adds them to `tenantry-admins` and removes them, through `https://initech.<base>/scim/v2`; the person signs in to Tenantry with the expected role at each step.
2. Revoking the token makes the next call 401; a new token works.
3. Setting two-step to required makes a password-only person set up a second step at their next sign-in; password, session and lockout settings show in the realm and survive `ops enterprise upgrade`.
4. The new README rows are `tested`.
5. `pnpm lint typecheck test build`, `pnpm test:scripts`, `pnpm smoke`, `pnpm seed` twice (the second changes nothing) and `pnpm test:isolation` pass, locally and in CI.

## Code structure (additions)

```
packages/auth/src/security.ts                       settings schema and bounds
packages/db/migrations/0004_phase5a.sql             tenant_scim_tokens, tenant_security + forced RLS
packages/db/src/repositories/scim-tokens.ts, security.ts
packages/keycloak-admin/src/realms/scim.ts          enable/disable SCIM, tenantry-scim client, mapped groups
packages/keycloak-admin/src/realms/security.ts      apply settings to a realm (provisioner)
packages/keycloak-admin/templates/enterprise-realm.v3.json
apps/api/src/modules/scim/                          ScimTokenGuard, gateway controller, token service
apps/api/src/modules/security/                      settings controller and service
apps/portal/src/features/security/, features/scim/  Security settings and SCIM pages
docs/guides/connect-scim.md, docs/decisions/0024-scim-gateway.md
```

## Data model

- `tenant_scim_tokens`: `id`, `tenant_id` (RLS), `token_hash bytea` (unique), `expires_at`, `created_by` → `users`, `created_at`, `last_used_at`, `revoked_at`. At most one row with `revoked_at is null` per tenant (partial unique index).
- `tenant_security`: `tenant_id` (RLS, primary key), `two_step text` check in (`off`, `optional`, `required`), `password_min_length`, `password_history`, `password_expiry_days`, `session_idle_minutes`, `session_max_hours`, `lockout_failures`, `lockout_wait_minutes`, `scim_default_role text` check in (`member`, `none`), `updated_by`, `updated_at`.

## API

| Method and path              | Who               | Does                                                                               |
| ---------------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| `GET /api/security`          | `tenant:settings` | Current settings (defaults when none saved)                                        |
| `PUT /api/security`          | `tenant:settings` | Save and apply                                                                     |
| `GET /api/scim`              | `tenant:settings` | SCIM URL, active token's expiry and last use (never the token), default role       |
| `POST /api/scim/token`       | `tenant:settings` | Body `{ expiresInDays: 90 \| 180 \| 365 }`; 201 `{ token, expiresAt }`, shown once |
| `DELETE /api/scim/token`     | `tenant:settings` | Revoke; 204                                                                        |
| `PUT /api/scim/default-role` | `tenant:settings` | `{ role: 'member' \| 'none' }`                                                     |
| `* /scim/v2/*`               | SCIM token        | The gateway                                                                        |

## Testing

- **Unit:** settings bounds at and past each limit, idle ≤ maximum; token format, hash compare, expiry; gateway forwarding with a fake Keycloak (path, query, `Location` rewrite, SCIM error bodies for 401/404/413/502, default-role grant after create and active PATCH and not after deactivate, DELETE of a mapped group empties it).
- **Keycloak contract** (fake and real): SCIM on/off, `tenantry-scim` rights, mapped groups grant and take back roles, settings written and read back, the second-step subflow's three states (probed first).
- **API integration:** token generate, replace, revoke (hash only in the table; the token never in audit); settings save and roll back on refusal; owners only; Standard 404; group-held roles on the Members page; upgrade not reporting tenant settings as drift but reporting a console edit.
- **Portal:** Security settings page (fields, bounds, save bar); SCIM page (generate shows the token once, replace, revoke, default role).
- **Isolation suite** (full stack): a SCIM token of workspace A on workspace B → 401; a person's token on `/scim` and a SCIM token on `/api` → 401; revoked or expired token → 401; SCIM-created people land only in their own realm and sign in with the default role; required two-step stops a password-only sign-in at the set-up step.

## Risks

| Risk                                                                      | Mitigation                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| "Required, any of TOTP, passkey or recovery code" does not work on 26.8.1 | Probed first; fallback to TOTP-required recorded                                                     |
| A directory removes everyone's role by deleting a mapped group            | DELETE of a mapped group empties it, keeping the mapping                                             |
| A directory change removes the last owner                                 | Owners are never managed by SCIM                                                                     |
| The gateway leaks one tenant's people to another                          | Token looked up only inside the host's tenant; forwarded only to that tenant's realm; isolation test |
| A long-lived token is stolen                                              | Hash only at rest, expiry at most a year, instant revoke, last-use shown in the portal               |
