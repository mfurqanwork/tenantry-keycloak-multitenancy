# Known issues and open items

The honest list of what does not work yet, what is missing, and what waits on a decision. Each phase adds to it and strikes out what it fixes. Decisions themselves live in [the ADRs](decisions/README.md) and each phase's spec.

Last updated: Phase 2 planning (2026-11-02).

## Open items that need a person

| Item                       | Why it waits                                                                                                                                    | Since   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Hosted public demo         | Needs a host for Keycloak, Postgres and the API (Vercel alone cannot run them) and a domain with wildcard subdomains. Pick a host and a domain. | Phase 0 |
| Demo video and launch post | Recorded and written by a person; Phase 2 ships the demo script and seeded data they follow.                                                    | Phase 2 |
| Pushing the `v0.1.0` tag   | The tag is created locally after Phase 2 merges; pushing it is yours.                                                                           | Phase 2 |

## Known limitations

| Area                  | What happens                                                                                                                             | Planned fix                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Members               | Lists and owner counts read at most 1,000 members from Keycloak.                                                                         | Paging, Phase 6                                 |
| Keycloak client edits | Each tenant's address is added to the SPA clients by one API process at a time; two API replicas could lose each other's edits.          | Database lock or a provisioning worker, Phase 6 |
| Keycloak client size  | Every tenant adds a redirect URI to the SPA clients; thousands may slow Keycloak.                                                        | Measured with the realm-count tests, Phase 6    |
| Service account       | `tenantry-backend` holds `manage-realm` and `manage-clients`, broader than needed.                                                       | Fine-grained admin permissions, Phase 6         |
| Invites               | Keycloak sends the invite email while our database transaction is open; if the audit write fails afterwards, a sent invite has no row.   | Outbox, Phase 6                                 |
| Invites               | Keycloak 26.8 cannot withdraw a sent invitation; a revoked invite is enforced when the person first visits (they are removed again).     | When Keycloak adds it                           |
| Users                 | Email and display name are copied on first sign-in and never refreshed; any platform user who opens a tenant address gets a `users` row. | Phase 3 (identity refresh)                      |
| Dev realm             | `tenantry-isolation-tests` (password grant, fixed secret) is in the only realm file; production imports must not include it.             | Production realm template, Phase 6              |
| Tests                 | The default 30-second key-set refetch cooldown has no test asserting a single refetch.                                                   | Phase 6                                         |
| Signup                | If marking a failed signup also fails, the original error is hidden in the log.                                                          | Phase 6                                         |
| Web UI                | The audit log shows raw ids as targets; breadcrumb and header-name links reload the page; "Load more" has no spinner.                    | Phase 2 (UI pass)                               |
| Tokens                | A role change takes effect in the token within five minutes; identity-changing endpoints already use the live role.                      | By design (ADR-0019)                            |

## Fixed

| Phase | What was wrong                                                                             | Fix                                           |
| ----- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| 2     | A Keycloak outage outside signup answered 500 instead of 502.                              | Every Keycloak failure answers 502.           |
| 2     | A plain member could not leave a workspace.                                                | `DELETE /api/members/me`, not the last owner. |
| 2     | AGENTS.md hard rule 2 named `organization.<alias>.realm_access`; the code reads `.groups`. | Rule reworded.                                |
