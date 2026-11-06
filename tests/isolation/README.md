# Isolation guarantees

Tenantry's promises about keeping workspaces apart. Each row is an automated test in this package, run in CI against real Keycloak and Postgres containers:

```bash
pnpm test:isolation
```

It needs the stack running (`pnpm dev:stack`; see [docs/SETUP.md](../../docs/SETUP.md)). The tests for each phase are in `src/phase<N>.test.ts`.

| Guarantee                                                              | Expected result                                                  | Phase | Status |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ----- | ------ |
| Tenant A user requests tenant B data with A's token                    | 404 (the row is invisible to A)                                  | 1     | tested |
| Tenant A user calls B's subdomain with A's token                       | 403                                                              | 1     | tested |
| A query that forgets the tenant filter                                 | Returns only the current tenant's rows (row-level security)      | 1     | tested |
| App database role tries to bypass row-level security                   | Not allowed; the role does not own the tables                    | 1     | tested |
| User is admin in org A and member in org B, acts in B                  | Treated as member                                                | 1     | tested |
| Client sends a tenant id header that differs from the token            | Ignored; the token decides                                       | 1     | tested |
| Member tries to invite, remove or change roles                         | 403                                                              | 1     | tested |
| Logout in one app                                                      | Session ends in the other app                                    | 2     | tested |
| Domain link without a verified DNS record                              | Refused                                                          | 2     | tested |
| Valid token from another enterprise realm                              | 401 (issuer rule)                                                | 3     | tested |
| Valid token from the shared realm on an enterprise tenant              | 401                                                              | 3     | tested |
| Token for the wrong audience                                           | 401                                                              | 3     | tested |
| Enterprise realm token on a Standard workspace                         | 401                                                              | 3     | tested |
| Password grant in an enterprise realm                                  | Refused by the realm's client policy                             | 3     | tested |
| Company login brings an email outside the verified domain              | Refused by Keycloak                                              | 3     | tested |
| Customer registers a wildcard or non-HTTPS redirect URI                | Refused by our API; plain http also by the realm's client policy | 4     | tested |
| Tenant A admin registers or edits an app in tenant B                   | 401 or 404                                                       | 4     | tested |
| User of another tenant signs in to a customer app                      | Refused                                                          | 4     | tested |
| Token issued to a customer app, used on Tenantry's API                 | 401                                                              | 4     | tested |
| A workspace's SCIM token on another workspace                          | 401 (another enterprise) or 404 (Standard)                       | 5a    | tested |
| A person's token on `/scim`, a SCIM token on `/api`                    | 401                                                              | 5a    | tested |
| A revoked or expired SCIM token                                        | 401                                                              | 5a    | tested |
| A person created through SCIM                                          | Exists only in the workspace's realm, with its default role      | 5a    | tested |
| Two-step sign-in required, password-only sign-in                       | Stopped at the authenticator set-up step                         | 5a    | tested |
| A moved workspace's person signs in through the bridge                 | Old password works; same Tenantry user and role                  | 5b    | tested |
| Someone not in the moved workspace uses the bridge                     | Refused by the realm; no account is made                         | 5b    | tested |
| Shared-realm token on a moved workspace                                | 401                                                              | 5b    | tested |
| Console user edits, resets or deletes an owner                         | 403                                                              | 5b    | tested |
| Console user grants console access, or opens clients or realm settings | 403                                                              | 5b    | tested |
| Console user reads another realm                                       | Refused                                                          | 5b    | tested |
| A person in two workspaces reads notifications in one                  | Only that workspace's events                                     | 6a    | tested |
| A member reads notifications                                           | No team, workspace or security events                            | 6a    | tested |
| Another workspace invites a person                                     | Only that verified address is told                               | 6a    | tested |
