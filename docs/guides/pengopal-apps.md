# Pengopal's apps: Sign in with Tenantry

Pengopal's own products sign in with Tenantry, starting with [PengOPA](https://opa.pengopal.com), Pengopal's policy app. On PengOPA's sign-in page, **Sign in with Tenantry** sits beside email and Google. The decision is [ADR-0032](../decisions/0032-pengopal-apps-sign-in.md).

## What people get

- **One sign-in.** Someone already signed in to Tenantry clicks the button and is in PengOPA with no login page. Someone in several workspaces picks one first.
- **The same workspace and role.** They land in the PengOPA workspace linked to the Tenantry workspace they picked. Owners are PengOPA Owners, admins Editors, members Viewers. The role is read again on every sign-in.
- **One sign-out.** Signing out of PengOPA ends the Tenantry session too; Tenantry's tabs sign out when next focused. Signing out of Tenantry ends PengOPA's sessions from it at once. Sessions made with email or Google in PengOPA are untouched.
- Only Standard workspaces, for now.

## Running both apps locally

1. Start Tenantry: `pnpm dev:stack`. Its dev realm already has the `pengopa` client, with the secret `dev-pengopa-secret`, the sign-in address `http://localhost:5180`, and back-channel sign-out to `http://host.docker.internal:3000`.
2. In PengOPA's `.env`, set:

   ```
   TENANTRY_ISSUER=http://auth.tenantry.localhost/realms/platform
   TENANTRY_INTERNAL_URL=http://127.0.0.1:8180
   TENANTRY_CLIENT_ID=pengopa
   TENANTRY_CLIENT_SECRET=dev-pengopa-secret
   ```

   `TENANTRY_INTERNAL_URL` is how PengOPA's server reaches Keycloak, for when it cannot resolve `*.localhost` (Node on Windows cannot). If Tenantry runs on another port (`TENANTRY_HTTP_PORT`), add it to the issuer.

3. Start PengOPA: `pnpm dev` (web on port 5180, server on 3000).
4. Sign in to a demo workspace at <http://tenantry.localhost>, then click **Sign in with Tenantry** on <http://localhost:5180/sign-in>.

The first sign-in from a Tenantry workspace makes its PengOPA workspace. To link an existing PengOPA workspace instead, run `pnpm --filter server tenantry:link <workspace-slug> <tenantry-workspace>` in PengOPA first.

## Production

- **Tenantry:** the VM's `/opt/tenantry/.env` holds `PENGOPA_CLIENT_SECRET` (new VMs get one from `bootstrap-vm.sh`) and, if PengOPA moves, `PENGOPA_URL`. A deploy re-imports the realm with them.
- **PengOPA:** its Railway variables are `TENANTRY_ISSUER=https://auth.tenantry.pengopal.com/realms/platform`, `TENANTRY_CLIENT_ID=pengopa`, and `TENANTRY_CLIENT_SECRET` with the same value as Tenantry's `PENGOPA_CLIENT_SECRET`.

## Checked by

- `tests/isolation/src/pengopa.test.ts`: a sign-in to `pengopa` carries the workspace's groups in the ID token, and its token is refused by Tenantry's API.
- PengOPA's own tests: the role mapping, the back-channel logout checks, and the workspace link.
- Single sign-on and sign-out between the two running apps are checked by hand.
