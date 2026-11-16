# Sign in with Tenantry for PengOPA: design and plan

Date: 2026-11-16 · Status: implemented. Where the build changed a decision, this document says what was built.

Two repositories:

- **Tenantry:** `mfurqanwork/tenantry-keycloak-multitenancy`, local at `C:\Users\furqa\Desktop\JobHunt2025\multi-tenant-idm-saas`. Read its `AGENTS.md` before changing it.
- **PengOPA:** `Pengopal/peng-opa`, local at `C:\Users\furqa\Desktop\Pengopal Technologies\peng-opa`.

Part A (Tenantry) is small and goes first, because Part B (PengOPA) is tested against it. Each part is its own pull request in its own repository.

## 1. What and why

PengOPA is the first Pengopal product offered to Tenantry workspaces. On PengOPA's sign-in and sign-up pages, **Sign in with Tenantry** sits beside Continue with Google, as an optional way in. Email and password and Google stay as they are.

- **Single sign-on:** if someone is already signed in to Tenantry, clicking Sign in with Tenantry signs them in to PengOPA with no login page. The click is still needed.
- **Workspace:** they land in the PengOPA workspace linked to the Tenantry workspace they chose, with a role that follows their Tenantry role.
- **Sign out of PengOPA:** this also ends the Tenantry (Keycloak) session. Tenantry's tabs notice on focus or on their next request (ADR-0020).
- **Sign out of Tenantry:** Keycloak calls PengOPA's server (back-channel logout), and PengOPA deletes the matching sessions at once.

## 2. Decisions

| Topic               | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which realm         | **Standard workspaces only**, in the `platform` realm. Issuer: `https://auth.tenantry.pengopal.com/realms/platform` (dev: `http://auth.tenantry.localhost/realms/platform`). Enterprise realms are out of scope (§8).                                                                                                                                                                                                                                             |
| Client              | One confidential client, `pengopa`, in the platform realm. Authorization code with PKCE S256. No direct grants, no implicit flow, no service account.                                                                                                                                                                                                                                                                                                             |
| Workspace choice    | PengOPA asks for the `organization` scope. A person in one Tenantry workspace goes straight through; a person in several gets Keycloak's organization picker. The token carries the chosen organization's alias.                                                                                                                                                                                                                                                  |
| Role claim          | The `oidc-organization-group-membership-mapper` on the `pengopa` client, written to the **ID token** (Tenantry's own clients put it only in the access token). Claim shape: `organization.<alias>.groups`. Keycloak sends group paths (`/owners`); a bare name is read the same way and a nested group (`/owners/x`) grants nothing, as in Tenantry's own API (hard rule 2; never `realm_access`).                                                                |
| Role mapping        | `owners` → `OWNER`, `admins` → `EDITOR`, `members` → `VIEWER`. When several groups are present, the highest wins. Re-applied on every Tenantry sign-in.                                                                                                                                                                                                                                                                                                           |
| Linking workspaces  | A PengOPA `Workspace` gains `tenantryOrg` (the alias, unique, nullable). If someone signs in with an alias that has no linked workspace, PengOPA creates one, named after the alias, with that person as a member at their mapped role. An existing PengOPA workspace (for example a "Pengopal" workspace made by hand) is linked with a one-off server script, not a UI.                                                                                         |
| Accounts            | better-auth's `genericOAuth` plugin, provider id `tenantry`. The user is matched by email. A sign-in links to an existing PengOPA user with the same email only when the ID token says `email_verified: true`, PengOPA's `getUserInfo` returns `emailVerified` from the verified ID token, and better-auth links implicitly only for verified emails; `trustedProviders` is unchanged.                                                                            |
| Session link        | A new PengOPA table, `tenantry_sessions`, with `sessionId` (PK, FK → `session.id`, cascade delete), `sid` (Keycloak session id, indexed), `sub` (indexed) and `workspaceId` (the workspace the sign-in landed in). The ID token stays on better-auth's `account` row. It is written when the Tenantry callback creates a session.                                                                                                                                 |
| Back-channel logout | `POST /api/tenantry/backchannel-logout` on PengOPA's Nest server. It is public, with no session guard, and takes `application/x-www-form-urlencoded` with `logout_token`. Keycloak's `backchannel.logout.session.required` is on, so tokens carry `sid`.                                                                                                                                                                                                          |
| Logout from PengOPA | better-auth's own provider logout: the `genericOAuth` provider has `endSessionEndpoint` and `postLogoutRedirectURI: "/sign-in"`. For a Tenantry session, `signOut()` deletes the session and returns Keycloak's end-session URL with `id_token_hint`; the web app goes there. Other sessions sign out as before. No endpoint of our own.                                                                                                                          |
| Secrets             | The client secret lives in Tenantry's VM `.env` and Keycloak's environment as `PENGOPA_CLIENT_SECRET`, and in PengOPA's Railway variables as `TENANTRY_CLIENT_SECRET`. It never goes in Postgres, logs or audit, and never into the repository (dev uses `dev-pengopa-secret`).                                                                                                                                                                                   |
| Optional everywhere | PengOPA works without Tenantry. The button and endpoints exist only when `TENANTRY_ISSUER`, `TENANTRY_CLIENT_ID` and `TENANTRY_CLIENT_SECRET` are all set. `TENANTRY_INTERNAL_URL` is optional: the server's own address for Keycloak, for the token and JWKS calls, when it cannot resolve the issuer's host (Node cannot resolve `*.localhost` on Windows). The browser always uses the issuer. `/api/config` gains `tenantryEnabled`, as with `googleEnabled`. |
| Testing             | Unit and e2e tests in each repo cover the pieces. Tenantry's isolation suite checks the client's ID token and that its token is refused. Single sign-on and single sign-out between the two running apps are **checked by hand** (§7), not in CI.                                                                                                                                                                                                                 |

## 3. The sign-in flow

```
PengOPA /sign-in ── Sign in with Tenantry ──▶ PengOPA /api/auth/sign-in/social, provider tenantry (better-auth)
   ──▶ auth.tenantry…/realms/platform/protocol/openid-connect/auth
        scope=openid email profile organization, PKCE
        (live Keycloak session: no login page; several workspaces: picker)
   ──▶ PengOPA /api/auth/callback/tenantry
        better-auth: code → tokens, find or create the user and account, create the session
        after-hook: read the ID token → write tenantry_sessions, link or create the workspace, upsert the membership
   ──▶ PengOPA /home?via=tenantry
        the web app drops the mark, asks GET /api/tenantry/session for the workspace, and selects it
```

## 4. The sign-out flows

**From PengOPA.** UserMenu calls better-auth's `signOut()`.

- For a Tenantry session the answer has `redirect` and Keycloak's end-session URL; the session is already gone and the browser goes there. Keycloak ends the session and returns to `${APP_URL}/sign-in`. Keycloak also back-channels PengOPA itself, which finds nothing left to delete; that's fine.
- Otherwise PengOPA signs out as before.

**From Tenantry.** Tenantry ends the Keycloak session (ADR-0020). Keycloak POSTs a logout token to PengOPA, and PengOPA:

1. Verifies the JWT with the issuer's JWKS (`jose` `createRemoteJWKSet`, cached):
   - `alg` is RS256;
   - `iss` is `TENANTRY_ISSUER` and `aud` includes `TENANTRY_CLIENT_ID`;
   - `iat` is at most 5 minutes old;
   - `events` has the key `http://schemas.openid.net/event/backchannel-logout`;
   - there is no `nonce`, and there is a `sid` or a `sub`.
2. Deletes every `session` row whose `tenantry_sessions.sid` matches. If there is no `sid`, it deletes every Tenantry-made session for that `sub`.
3. Answers `200` with `Cache-Control: no-store`. It answers `400` with `{ "error": "invalid_request" }` for a missing or invalid token, and never says why in the body. It logs the reason without the token.

Sessions made with email, password or Google are never touched.

## 5. Part A: Tenantry

**Files**

- `infra/keycloak/platform-realm.json`: the `pengopa` client.
  - Confidential, `secret: "dev-pengopa-secret"`, `standardFlowEnabled: true`, `directAccessGrantsEnabled: false`, `implicitFlowEnabled: false`.
  - `redirectUris: ["http://localhost:5180/api/auth/callback/tenantry"]` and `webOrigins: []`.
  - Attributes:
    - `pkce.code.challenge.method: S256`
    - `post.logout.redirect.uris: http://localhost:5180/*`
    - `backchannel.logout.url: http://host.docker.internal:3000/api/tenantry/backchannel-logout`
    - `backchannel.logout.session.required: true`
    - `backchannel.logout.revoke.offline.tokens: false`
  - `frontchannelLogout: false`.
  - The `organization groups` protocol mapper with `id.token.claim: "true"`. **No** `tenantry-api` audience mapper, so its tokens are refused by Tenantry's API.
  - No `optionalClientScopes`: `organization` is already one of the realm's default optional scopes, and the import test keeps clients off Keycloak's built-in scopes.
- `scripts/lib/prod-realm.mjs`: set `pengopa`'s production values.
  - `secret: '${PENGOPA_CLIENT_SECRET}'`
  - `redirectUris: [`${PENGOPA_URL}/api/auth/callback/tenantry`]`
  - `post.logout.redirect.uris: ${PENGOPA_URL}/*`
  - `backchannel.logout.url: ${PENGOPA_URL}/api/tenantry/backchannel-logout`
  - `PENGOPA_URL` is `https://opa.pengopal.com`, passed like `TENANTRY_BASE_DOMAIN`. Extend its test (`scripts/lib/prod-realm.test.mjs` or the existing one) to assert these four values and that the dev secret never reaches production.
- `infra/prod/compose.prod.yml` (Keycloak environment), `infra/prod/bootstrap-vm.sh` (`PENGOPA_CLIENT_SECRET=$(secret)`), `.env.example`: the new variables.
- **The live realm.** A deploy rebuilds the stack and re-imports the platform realm (ADR-0029), so the client arrives with the release. No operator command.
- `tests/isolation`: one guarantee (`pengopa.test.ts`). A browser sign-in to `pengopa` returns an ID token with the workspace's groups, and its access token is refused by Tenantry's API (401), because it lacks the `tenantry-api` audience. The browser-flow helper gains `signInForTokens` with a client secret and scope. Add the row to the guarantees table in the README.
- `docs/decisions/0032-pengopal-apps-sign-in.md` (ADR-0031 is taken by the redesign). It records the decisions in §2, why back-channel works for PengOPA when ADR-0020 rejected it for Tenantry's SPAs (PengOPA has a server session), and the Enterprise limit. Link it from ADR-0020's Consequences.
- `docs/guides/pengopal-apps.md`: a short guide to what Sign in with Tenantry is and how to run both apps locally (§7). Add a link from the README.
- `CHANGELOG.md`: a line under Unreleased, Added.

**Done when:**

- lint, typecheck, test and `pnpm test:scripts` pass;
- the stack starts with the new client;
- the isolation test passes against the running stack;
- a manual authorization request for `pengopa` with `scope=openid organization` returns an ID token with `organization.<alias>.groups`.

## 6. Part B: PengOPA

Follow the repo's own conventions (`CONTRIBUTING.md`, `apps/web/DESIGN.md`, `UI-PATTERNS.md`). The tasks below are in order; write each test first.

1. **Config.** `apps/server/src/config/config.ts` gains an optional `tenantry` block (`issuer`, `internalUrl?`, `clientId`, `clientSecret`; env `TENANTRY_ISSUER`, `TENANTRY_INTERNAL_URL`, `TENANTRY_CLIENT_ID`, `TENANTRY_CLIENT_SECRET`). `loadConfig` throws if only some are set. `config.controller.ts` returns `tenantryEnabled`. Add the variables to `.env.example` (dev issuer `http://auth.tenantry.localhost/realms/platform`, client `pengopa`, secret `dev-pengopa-secret`) and to `docs/DEPLOY.md` for Railway.
   - Tests: the all-or-none rule; `tenantryEnabled` true and false.
2. **Schema.**
   - Prisma migration: `Workspace.tenantryOrg String? @unique`.
   - Model `TenantrySession` mapped to `tenantry_sessions`, with `sessionId String @id` (relation to `Session`, `onDelete: Cascade`), `sid String?`, `sub String`, `workspaceId String?`, and `@@index([sid])` and `@@index([sub])`.
   - Check that the tenant-scoped Prisma client's rules (`prisma.unscoped` vs scoped) still hold for these tables.
3. **better-auth provider.** In `auth.service.ts`, when Tenantry is configured, add `genericOAuth`:
   - explicit `authorizationUrl` and `endSessionEndpoint` on the issuer, `tokenUrl` on `TENANTRY_INTERNAL_URL` when set (no discovery), scopes `openid email profile organization`, `pkce: true`;
   - `getUserInfo` verifies the ID token (signature from the JWKS, `iss`, `aud`) itself, since without discovery better-auth does not;
   - better-auth 1.7 registers generic providers as social ones: the web app calls `signIn.social({ provider: "tenantry" })`.
   - Test: the provider is present only when configured.
4. **The callback hook.** A better-auth `hooks.after` (`createAuthMiddleware`) matching the path `/callback/` with `ctx.params.id === "tenantry"`, where `ctx.context.newSession` exists. It reads the user's `tenantry` account `idToken` (decode only: it came from the token endpoint over TLS with client authentication), then, in one transaction:
   - writes `tenantry_sessions`;
   - finds or creates the workspace by `tenantryOrg = alias`;
   - upserts the `Member` with the mapped role (§2).

   Put the claim parsing and role mapping in a pure module (`tenantry-claims.ts`) with unit tests:
   - one org;
   - groups `["admins","members"]` → `EDITOR`;
   - no `organization` claim → no workspace change, session still linked;
   - unknown group names ignored.

   If the user ends up with no workspace, they go to onboarding as today.

5. **Back-channel logout.** A `TenantryController` (public) with `POST /api/tenantry/backchannel-logout`, as §4. Put JWKS fetching behind an injectable so tests sign tokens with a local key. e2e tests:
   - valid token with `sid` deletes only that session;
   - valid with `sub` only deletes all Tenantry sessions of that user and leaves a Google or email session;
   - each of these gets `400` and deletes nothing: wrong `aud`, wrong `iss`, expired, `nonce` present, missing `events`, bad signature, missing token.
6. **Sign-out.** better-auth's provider logout as §4; `UserMenu.tsx` follows the returned URL. `GET /api/tenantry/session` (session guard) names the workspace the sign-in landed in, for the web app to select.
7. **The button.**
   - On `SignIn.tsx` and `SignUp.tsx`, when `config.tenantryEnabled`: `<ProviderButton logo={<TenantryLogo />} label="Sign in with Tenantry" onClick={() => void signInWithTenantry(withTenantryLanding(next))} />`, above Google, sharing the one `OrDivider`.
   - `TenantryLogo` shows Tenantry's mark from `apps/web/public/brand/tenantry-mark.svg` and `tenantry-mark-dark.svg` (copy them from Tenantry's `packages/ui/assets/brand/`), swapping on the dark theme, `aria-hidden`, at the same size as the Google G.
   - Tests in `ProviderButton.spec.tsx` / page specs: the button shows only when enabled and starts the `tenantry` provider.
8. **Link script.** `pnpm --filter server tenantry:link <workspace-slug> <tenantry-alias>` (`src/tenantry/link-workspace.cli.ts`): sets `tenantryOrg`, and refuses if the alias is already linked. Document it in `docs/SETUP.md`.
9. **Docs.** A section in `docs/SETUP.md` on running with Tenantry locally (§7); `docs/known-issues.md`: the limits in §8.

**Done when:**

- lint, typecheck, test and test:e2e pass;
- with Tenantry unset, nothing changes (no button, endpoints answer 404);
- the manual checks in §7 pass.

## 7. Checking it by hand (both stacks local)

Setup:

- Tenantry: `pnpm dev:stack` (Keycloak at `auth.tenantry.localhost`), seeded.
- PengOPA: `pnpm dev` with the `TENANTRY_*` variables (`TENANTRY_INTERNAL_URL=http://127.0.0.1:8180`), web on `http://localhost:5180`, server on `:3000`. Keycloak in Docker reaches it through `host.docker.internal:3000`.

Checks:

1. Signed in to Tenantry as a member of one workspace: PengOPA's Sign in with Tenantry lands in the linked workspace with no login page and the mapped role.
2. A member of two workspaces sees Keycloak's picker; each choice lands in its own workspace.
3. Signed out of everything: the button shows Keycloak's login page, and after signing in, both apps are signed in.
4. Sign out in PengOPA: PengOPA returns to `/sign-in`, and the Tenantry tab signs out when focused.
5. Sign out in Tenantry: PengOPA's next request is 401 and it shows sign-in. The `tenantry_sessions` row is gone.
6. An email-and-password PengOPA session in another browser survives step 5.
7. Changing someone's role in Tenantry Admin and signing in to PengOPA again updates their PengOPA role.

## 8. Out of scope and limits

- **Enterprise workspaces.** Each lives in its own realm with its own issuer, so PengOPA would have to ask which workspace before redirecting. That is a later phase: a `pengopa` product client in the enterprise template plus a "workspace address" step on PengOPA.
- **Removal.** Someone removed from a Tenantry workspace keeps their PengOPA membership until a PengOPA owner removes it. Their Tenantry sign-in can no longer choose that workspace. Directory sync to PengOPA is a later phase.
- **A missed back-channel call** (PengOPA down when Tenantry signs out) leaves that PengOPA session alive until it expires. Keycloak does not retry.
- Tenantry's other apps, PengOPA's API keys and the OPA data plane are unchanged.
