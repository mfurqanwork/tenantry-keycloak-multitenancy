import { createHash, randomBytes } from 'node:crypto';
import { env, KEYCLOAK_URL } from './env.js';

// Keycloak writes its public address into pages and redirects; Node reaches it on the loopback port.
const PUBLIC_AUTH = new URL(env('TENANTRY_AUTH_URL')).origin;
const local = (url: string) =>
  url.startsWith(PUBLIC_AUTH) ? KEYCLOAK_URL + url.slice(PUBLIC_AUTH.length) : url;

export interface Page {
  url: string;
  status: number;
  html: string;
}

// A browser's cookie jar, scoped by path so two realms' session cookies never mix.
class Jar {
  private readonly cookies = new Map<string, { value: string; path: string }>();

  store(res: Response): void {
    for (const line of res.headers.getSetCookie()) {
      const [pair = '', ...attrs] = line.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const path =
        attrs
          .map((a) => a.trim())
          .find((a) => a.toLowerCase().startsWith('path='))
          ?.slice(5) ?? '/';
      const expired = attrs.some((a) => /^max-age=0$/i.test(a.trim())) || value === '';
      if (expired) this.cookies.delete(`${name};${path}`);
      else this.cookies.set(`${name};${path}`, { value, path });
    }
  }

  header(url: string): string {
    const path = new URL(url).pathname;
    return [...this.cookies.entries()]
      .filter(([, c]) => path.startsWith(c.path.replace(/\/$/, '')))
      .map(([key, c]) => `${key.split(';')[0] ?? ''}=${c.value}`)
      .join('; ');
  }
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/&quot;/g, '"');

// The login form's target: a plain <form action> (Keycloak's own themes) or Keycloakify's kcContext.
export function formAction(html: string): string {
  const fromContext = /"loginAction"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(html)?.[1];
  if (fromContext) return JSON.parse(`"${fromContext}"`) as string;
  const fromForm = /<form[^>]*\saction="([^"]+)"/i.exec(html)?.[1];
  if (fromForm) return decode(fromForm);
  throw new Error('no login form on the page');
}

// One browser tab: follows Keycloak's redirects until it leaves Keycloak for the app's redirect URI.
export class Browser {
  private readonly jar = new Jar();

  constructor(private readonly redirectUri: string) {}

  async open(url: string, init: { method?: string; form?: Record<string, string> } = {}): Promise<Page> {
    let next = url;
    let method = init.method ?? 'GET';
    let body: URLSearchParams | undefined = init.form ? new URLSearchParams(init.form) : undefined;
    for (let hops = 0; hops < 20; hops++) {
      if (next.startsWith(this.redirectUri)) return { url: next, status: 302, html: '' };
      const target = local(next);
      const res = await fetch(target, {
        method,
        redirect: 'manual',
        headers: { cookie: this.jar.header(target) },
        ...(body ? { body } : {}),
      });
      this.jar.store(res);
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        next = new URL(location, next).toString();
        method = 'GET';
        body = undefined;
        continue;
      }
      return { url: next, status: res.status, html: await res.text() };
    }
    throw new Error(`too many redirects from ${url}`);
  }

  submit(page: Page, fields: Record<string, string>): Promise<Page> {
    return this.open(new URL(formAction(page.html), page.url).toString(), { method: 'POST', form: fields });
  }
}

// Signs a person in through a realm's login page with the authorization code flow and PKCE,
// the only way an enterprise realm hands out a token (it refuses the password grant).
export async function signInWithBrowser(o: {
  realm: string;
  clientId: string;
  redirectUri: string;
  username: string;
  password: string;
}): Promise<string> {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const oidc = `${PUBLIC_AUTH}/realms/${o.realm}/protocol/openid-connect`;
  const browser = new Browser(o.redirectUri);
  const login = await browser.open(
    `${oidc}/auth?${new URLSearchParams({
      client_id: o.clientId,
      redirect_uri: o.redirectUri,
      response_type: 'code',
      scope: 'openid',
      state: randomBytes(8).toString('hex'),
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString()}`,
  );
  const done = await browser.submit(login, { username: o.username, password: o.password });
  const code = done.url.startsWith(o.redirectUri) ? new URL(done.url).searchParams.get('code') : null;
  if (!code) throw new Error(`sign-in to ${o.realm} did not finish: ${String(done.status)} at ${done.url}`);
  const res = await fetch(local(`${oidc}/token`), {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: o.clientId,
      code,
      redirect_uri: o.redirectUri,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`code exchange in ${o.realm}: ${String(res.status)} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}
