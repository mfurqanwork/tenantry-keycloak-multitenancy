# @tenantry/oidc-client

Sign-in for the SPAs, and the only code that imports `oidc-client-ts`.

- `fetchAuthConfig(slug)`: asks the API which realm, client and organization a tenant host signs in to.
- `createAuthClient(config)`: authorization code with PKCE (S256). Tokens live in `sessionStorage`. An expired access token is renewed with the refresh token.
- `<AuthProvider>` and `useAuth()`: finish the redirect on `/auth/callback`, send signed-out visitors to Keycloak, and expose the user and `getAccessToken`.

Phase 2 adds redirect-based silent login (`prompt=none`) and single logout.
