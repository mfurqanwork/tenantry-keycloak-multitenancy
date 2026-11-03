# Connect your app

For owners and admins of an **Enterprise** workspace. Your workspace has a Keycloak realm of its own; registering an app adds a client to that realm, so the people in your workspace sign in to your app with the same account, and the same session, as Tenantry. Standard workspaces cannot register apps (ADR-0011).

## Register it

In the portal, open **Applications** and choose **Register an app**. Pick the type, then give it a name and its URIs.

| Type                  | Pick it for                               | What Keycloak gets                                       | Secret |
| --------------------- | ----------------------------------------- | -------------------------------------------------------- | ------ |
| Web app               | A server-side app or backend-for-frontend | Confidential client, authorization code                  | Yes    |
| Single-page app       | React, Vue or Angular in the browser      | Public client, authorization code with PKCE (S256)       | No     |
| Mobile or desktop app | iOS, Android, Electron                    | Public client, PKCE, custom-scheme or loopback redirects | No     |
| Machine to machine    | A service calling APIs; nobody signs in   | Confidential client, client credentials only             | Yes    |

### URI rules

- Redirect and post-logout URIs use `https://` with a real host name.
- For development, `http://127.0.0.1:<port>` and `http://[::1]:<port>` work. `localhost` names do not: use `127.0.0.1`.
- Mobile and desktop apps may also use a custom scheme with a dot in it, such as `com.example.app:/callback`.
- No `*` in a host name and no `#fragment`. At most 10 URIs in each list.
- Allowed origins (single-page apps) are scheme, host and port only. Left empty, the redirect URIs' origins are allowed.

A workspace can register 20 apps (`TENANTRY_MAX_APPS_PER_TENANT`).

## Connection details

The app's page shows what to configure in your app:

| Detail                        | Value                                        |
| ----------------------------- | -------------------------------------------- |
| Issuer                        | `https://auth.<your host>/realms/ent-<slug>` |
| Discovery URL                 | `<issuer>/.well-known/openid-configuration`  |
| Authorization endpoint        | `<issuer>/protocol/openid-connect/auth`      |
| Token endpoint                | `<issuer>/protocol/openid-connect/token`     |
| JWKS URL (verifying tokens)   | `<issuer>/protocol/openid-connect/certs`     |
| End-session (logout) endpoint | `<issuer>/protocol/openid-connect/logout`    |
| Client ID                     | `app-` and eight characters                  |
| Scopes                        | `openid profile email`                       |

**The client secret is shown once**, when you register a web or machine-to-machine app and each time you rotate its secret. Tenantry does not keep it. If it is lost, rotate it: the old secret stops working at once.

The **Set up** tab has snippets for Node (`openid-client`), the browser (`oidc-client-ts`) and `curl`, filled with your app's values. [`examples/customer-app`](../../examples/customer-app/README.md) is the Node snippet as a running app.

## Test it

- **Web, single-page and mobile apps:** **Test sign-in** signs you in to the app through Keycloak and comes back to the portal. For single-page and mobile apps it shows the token's issuer, subject and audience. A web app's test stops when Keycloak hands back the sign-in code, because the portal does not hold the secret.
- **Machine to machine:** **Request a token** asks for one client-credentials token with the secret you paste. Nothing keeps the secret.

To make the test work, each app people sign in to also lists the portal's `/applications/test-callback` as a redirect URI. The app's page shows it; you cannot remove it.

## What your app's tokens can and cannot do

Your app's tokens carry who signed in (`sub`, `email`, `name`), not their role in your workspace, and Tenantry's own API refuses them: only Tenantry's two apps can call it. Use your app's tokens with your own APIs.

## Operators

`pnpm ops apps list|register|rotate --tenant <slug>` does the same through the API's operator routes, audited as coming from ops. `pnpm seed` uses it to register the demo's "Initech HR".
