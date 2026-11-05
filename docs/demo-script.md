# Demo script (about two minutes)

The walkthrough for the demo video. It runs on a fresh clone. Addresses assume port 80; with another port (for example `TENANTRY_HTTP_PORT=8080`), add `:8080` to each.

## Before recording

```bash
pnpm install
pnpm dev:stack
pnpm seed
```

All demo accounts use the password in `SEED_PASSWORD` (`.env`). They are local test accounts only; the full list is in [SETUP.md](SETUP.md#demo-accounts).

| Account            | Where                                 |
| ------------------ | ------------------------------------- |
| `ada@example.test` | Owner of `acme`                       |
| `cy@example.test`  | Member of `acme`                      |
| `pat@example.test` | Member of `acme` and `globex`         |
| `alice@acme.test`  | Signs in through Acme's company login |

Use a private window, so no earlier session is signed in.

## 1. The front door (15 s)

1. Open <http://tenantry.localhost>. The welcome page says what Tenantry is, with **Create a workspace**, **Go to your workspace** and the demo workspaces.
2. Choose **acme**. The login page shows Acme's logo and blue.

## 2. A new owner's first minute (30 s)

1. Sign in as `ada@example.test`. Tenantry opens on **Home**, in Acme's colour, with the **Get started** checklist.
2. Type a project name in the first step and press **Create**: the step is done.
3. Choose **Invite a teammate**. **Admin** opens at **People** with the invite dialog already open, and with no login page: one sign-in across both apps.
4. Close the dialog. The menu holds People, Branding, Sign-in & security and Audit log; **Advanced** keeps SCIM and the rest out of the way.

## 3. Branding with a contrast check (25 s)

1. In Admin, open **Branding**.
2. Type `#ffcc00` and save. The page refuses the colour: white text would be unreadable on it. It suggests a darker shade.
3. Choose **Use this colour** and save. The preview, both apps and the login page take the new colour.

## 4. Members, and switching workspaces (20 s)

1. Sign out (account menu, top right), and sign in as `cy@example.test`, a member. Tenantry shows Home and Projects, with no app switcher: Admin is for owners and admins.
2. Sign out, and sign in as `pat@example.test`.
3. Open the workspace switcher and choose **Globex**. Globex opens in green, with no login page.

## 5. Company login (20 s)

1. Sign out, then open <http://acme.tenantry.localhost>.
2. Type `alice@acme.test`, or choose **Acme Corp**. Keycloak sends her to the stand-in for her company's Entra or Okta.
3. Sign in there. She is back in Acme.
4. Explain the guard rail: an operator linked `acme.test` only after a DNS TXT record proved Acme owns it. Show the refusal:

```bash
pnpm ops idp link --tenant globex --domain globex.test --alias globex-corp --issuer http://auth.tenantry.localhost/realms/corp-demo --client-id tenantry-platform --client-secret-env CORP_DEMO_CLIENT_SECRET
```

It answers `globex.test is not verified for globex` (claim it first with `pnpm ops domain claim`), and nothing is created in Keycloak.

## 6. Single logout (10 s)

1. Have Tenantry and Admin open in two windows side by side.
2. Sign out in Tenantry.
3. Click into the Admin window. It goes to the login page at once: the Keycloak session is over (ADR-0020).

## Closing (10 s)

Point at the README's guarantees: every one runs in CI against real Keycloak and Postgres.
