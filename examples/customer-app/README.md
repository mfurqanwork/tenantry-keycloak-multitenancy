# Example customer app: Initech HR

A small Express app that an enterprise customer might run, signing in through its own realm (ADR-0011). It is a **web app with a backend**: a confidential client using authorization code with PKCE, through [`openid-client`](https://github.com/panva/openid-client).

Because the app lives in the same realm as Tenantry's own apps, someone signed in to Tenantry is signed in here without a login page, and signing out here ends the Tenantry session too.

## Run it

```bash
pnpm seed
```

```bash
pnpm example:customer-app
```

Then open <http://127.0.0.1:4000> and sign in as Initech's owner (`owner@initech.test`, with `SEED_PASSWORD`). Use `127.0.0.1`, not `localhost`: the realm accepts loopback redirects by address only.

`pnpm seed` registers the app as "Initech HR" and writes its settings to `examples/customer-app/.env`, which git ignores because it holds the client secret. To run it against another app, copy `.env.example` to `.env` and fill it from the app's connection details in the portal.

| Setting             | From                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `ISSUER`            | Connection details: Issuer                                                                 |
| `CLIENT_ID`         | Connection details: Client ID                                                              |
| `CLIENT_SECRET`     | Shown once when the app was registered or its secret rotated                               |
| `AUTH_INTERNAL_URL` | Optional. Where this process reaches Keycloak when the issuer's host does not resolve here |
