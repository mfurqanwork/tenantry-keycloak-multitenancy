// A customer's own web app, signing in through its enterprise tenant's realm (ADR-0011). Because the
// realm also holds Tenantry's apps, someone already signed in to Tenantry gets in without a login page.
// Deliberately small: one file, sessions in memory, no framework beyond Express.
import { randomBytes } from 'node:crypto';
import express from 'express';
import * as client from 'openid-client';
import { internalUrl, loadConfig } from './config.js';

const config = loadConfig(process.env);
const redirectUri = `${config.baseUrl}/callback`;

const oidc = await client.discovery(new URL(config.issuer), config.clientId, config.clientSecret, undefined, {
  // Local development runs Keycloak on http; anywhere else the issuer is https. openid-client marks this
  // option deprecated only so that it stands out.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  ...(config.issuer.startsWith('http://') ? { execute: [client.allowInsecureRequests] } : {}),
  [client.customFetch]: (url, options) =>
    fetch(internalUrl(url, config.issuer, config.authInternalUrl), options as RequestInit),
});

interface Session {
  verifier?: string;
  state?: string;
  email?: string;
  name?: string;
  idToken?: string;
}
const sessions = new Map<string, Session>();
const COOKIE = 'customer_app_sid';

function session(req: express.Request, res: express.Response): Session {
  const sid = /(?:^|;\s*)customer_app_sid=([\w-]+)/.exec(req.headers.cookie ?? '')?.[1];
  const found = sid ? sessions.get(sid) : undefined;
  if (sid && found) return found;
  const id = randomBytes(18).toString('base64url');
  const fresh: Session = {};
  sessions.set(id, fresh);
  res.cookie(COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/' });
  return fresh;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);
const page = (body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Initech HR</title></head><body><h1>Initech HR</h1>${body}</body></html>`;

const app = express();

app.get('/', (req, res) => {
  const s = session(req, res);
  res.send(
    page(
      s.email
        ? `<p>Signed in as ${escape(s.email)}</p><p><a href="/logout">Sign out</a></p>`
        : '<p><a href="/login">Sign in</a></p>',
    ),
  );
});

app.get('/login', async (req, res) => {
  const s = session(req, res);
  s.verifier = client.randomPKCECodeVerifier();
  s.state = client.randomState();
  const url = client.buildAuthorizationUrl(oidc, {
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    code_challenge: await client.calculatePKCECodeChallenge(s.verifier),
    code_challenge_method: 'S256',
    state: s.state,
  });
  res.redirect(url.href);
});

app.get('/callback', async (req, res) => {
  const s = session(req, res);
  try {
    const tokens = await client.authorizationCodeGrant(oidc, new URL(req.originalUrl, config.baseUrl), {
      ...(s.verifier ? { pkceCodeVerifier: s.verifier } : {}),
      ...(s.state ? { expectedState: s.state } : {}),
    });
    const claims = tokens.claims();
    s.email = typeof claims?.['email'] === 'string' ? claims['email'] : (claims?.sub ?? 'someone');
    s.idToken = tokens.id_token;
    delete s.verifier;
    delete s.state;
    res.redirect('/');
  } catch (err) {
    res
      .status(400)
      .send(page(`<p>Sign-in failed: ${escape(err instanceof Error ? err.message : String(err))}</p>`));
  }
});

// Ends the realm session, so Tenantry's apps sign out too (single logout).
app.get('/logout', (req, res) => {
  const s = session(req, res);
  const url = client.buildEndSessionUrl(oidc, {
    post_logout_redirect_uri: `${config.baseUrl}/`,
    ...(s.idToken ? { id_token_hint: s.idToken } : {}),
  });
  delete s.email;
  delete s.name;
  delete s.idToken;
  res.redirect(url.href);
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Initech HR is on ${config.baseUrl} (client ${config.clientId}).`);
});
