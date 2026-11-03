# ADR-0020: Single logout through the Keycloak session, checked on focus

Status: Accepted · Date: 2026-11-03

## Context

A person signs in once and uses two apps on different origins: the web app at `<slug>.<base>` and the portal at `<slug>.portal.<base>`. Each app keeps its own tokens in `sessionStorage` (ADR-0009). Signing out in one app must sign them out of the other too.

Keycloak offers two ways to tell other apps. Back-channel logout calls each client's server, but our apps are SPAs with no server session to end. Front-channel logout loads each client's logout page in a hidden frame, which third-party cookie rules now block across sites.

## Decision

- "Sign out" calls Keycloak's end-session endpoint with `id_token_hint` and `post_logout_redirect_uri` set to the app's own address. That ends the Keycloak session, and with it every refresh token issued in it.
- Each app checks the session itself: when its tab becomes visible, `@tenantry/oidc-client` trades the refresh token (`checkSession`). Keycloak answers `invalid_grant` ("Session not active") once the session has ended, so the app forgets its tokens and sends the person to sign in, which shows the Keycloak login page.
- The same happens on any API call after the access token expires, because renewing it also uses the refresh token.
- Each app signs in with its own public client (`tenantry-web`, `tenantry-portal`). Signup registers both origins.
- Silent sign-in is the plain redirect: with a live Keycloak session the authorization redirect returns at once. No iframes.

## Alternatives considered

- Back-channel logout with a BFF (a small server per app holding the session): logout is instant everywhere, but every app needs a server, and the SPAs lose their simple static hosting.
- Keycloak's session iframe (`check_session_iframe`): blocked by third-party cookie rules in current browsers.

## Consequences

- A tab that stays in front, with no API call, keeps working until its access token expires (at most five minutes) and then signs out. Switching to the tab signs out at once.
- No extra servers, and nothing for Keycloak to call.
- The guarantee test in `tests/isolation` proves the server side: after logout, a refresh with that session's refresh token fails.
