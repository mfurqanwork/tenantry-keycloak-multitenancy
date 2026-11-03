# Demo script (about two minutes)

The walkthrough for the v0.1 demo video. It runs on a fresh clone. Addresses assume port 80; with another port (for example `TENANTRY_HTTP_PORT=8080`), add `:8080` to each.

## Before recording

```bash
pnpm install
pnpm dev:stack
pnpm seed
```

All demo accounts use the password in `SEED_PASSWORD` (`.env`). They are local test accounts only.

| Account            | Where                                 |
| ------------------ | ------------------------------------- |
| `ada@example.test` | Owner of `acme`                       |
| `ben@example.test` | Admin of `acme`                       |
| `gil@example.test` | Owner of `globex`                     |
| `pat@example.test` | Member of `acme` and `globex`         |
| `alice@acme.test`  | Signs in through Acme's company login |

Use a private window, so no earlier session is signed in.

## 1. One sign-in, two apps (20 s)

1. Open <http://acme.tenantry.localhost>. The login page shows Acme's logo and blue.
2. Sign in as `ada@example.test`. The Acme web app opens, in Acme's colour.
3. Open the app switcher (top right) and choose **Tenantry Portal**. The portal opens signed in, with no login page.

## 2. Branding with a contrast check (25 s)

1. In the portal, open **Branding**.
2. Type `#ffcc00` and save. The page refuses the colour: white text would be unreadable on it. It suggests a darker shade.
3. Choose **Use this colour** and save. The preview, the page and the login page all take the new colour.
4. Optional: drop in a PNG logo under 256 KB.

## 3. Switching workspaces (20 s)

1. Sign out (account menu, top right).
2. Sign in as `pat@example.test`.
3. Open the workspace switcher and choose **Globex**. Globex opens in green, with no login page.

## 4. Company login (30 s)

1. Sign out, then open <http://acme.tenantry.localhost>.
2. Type `alice@acme.test`. Keycloak sends her to "Acme Corp sign-in (demo)", the stand-in for her company's Entra or Okta.
3. Sign in there. She is back in Acme as a Member.
4. Explain the guard rail: an operator linked `acme.test` only after a DNS TXT record proved Acme owns it. Show the refusal:

```bash
pnpm ops idp link --tenant globex --domain globex.test --alias globex-corp --issuer http://auth.tenantry.localhost/realms/corp-demo --client-id tenantry-platform --client-secret-env CORP_DEMO_CLIENT_SECRET
```

It answers `globex.test is not verified for globex` (claim it first with `pnpm ops domain claim`), and nothing is created in Keycloak.

## 5. Single logout (15 s)

1. Have the web app and the portal open in two windows side by side.
2. Sign out in the web app.
3. Click into the portal window. It goes to the login page at once: the Keycloak session is over (ADR-0020).

## Closing (10 s)

Point at the README's guarantees table: every row marked _tested_ runs in CI against real Keycloak and Postgres.
