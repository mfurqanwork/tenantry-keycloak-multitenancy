// Customer applications (ADR-0011): the four OIDC types and the rules every URI they register must meet.
// Shared by the API and the portal, so the form says what the API would say.
export type AppType = 'web' | 'spa' | 'native' | 'm2m';

export const APP_TYPES: readonly AppType[] = ['web', 'spa', 'native', 'm2m'];

export const APP_LIMITS = { uris: 10, nameMax: 80 } as const;

// Types a person signs in to (authorization code), as opposed to machine-to-machine.
export const userSignIn = (type: AppType): boolean => type !== 'm2m';

// Types that hold a client secret.
export const confidential = (type: AppType): boolean => type === 'web' || type === 'm2m';

export function normaliseUris(list: readonly string[]): string[] {
  return [...new Set(list.map((uri) => uri.trim()).filter((uri) => uri !== ''))];
}

const LOOPBACK = new Set(['127.0.0.1', '[::1]']);
const AUTHORITY = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i;

// http(s) only: https anywhere, http on a loopback address only. Keycloak refuses localhost names over
// https, so they are refused here too.
function webProblem(url: URL): string | null {
  if (url.protocol === 'https:') return url.hostname ? null : 'Enter a full URI.';
  if (LOOPBACK.has(url.hostname)) return null;
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
    return 'Use 127.0.0.1 instead of localhost.';
  }
  return 'Use https (http only for 127.0.0.1 or [::1]).';
}

// The message the person should see, or null when the URI is fine.
export function uriProblem(uri: string, kind: 'redirect' | 'origin', type: AppType): string | null {
  if (AUTHORITY.exec(uri)?.[1]?.includes('*')) return 'No wildcards in the host.';
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return 'Enter a full URI.';
  }
  const web = url.protocol === 'https:' || url.protocol === 'http:';
  // The parser also reads "https:*.host" and "https:/host" as hosts: check what it read, and ask for
  // the written-out form so the stored URI is the one Keycloak will compare.
  if (web && url.hostname.includes('*')) return 'No wildcards in the host.';
  if (web && !/^https?:\/\/[^/\\]/i.test(uri)) return 'Enter a full URI.';
  if (kind === 'origin') {
    if (!web) return 'Enter a full URI.';
    const problem = webProblem(url);
    if (problem) return problem;
    return url.origin === uri.replace(/\/$/, '') ? null : 'An origin has no path.';
  }
  if (uri.includes('#')) return 'No fragment (#) in a redirect URI.';
  // Keycloak reads a trailing * as "any path from here": too broad for a customer's redirect.
  if (uri.includes('*')) return 'No wildcards in a redirect URI.';
  if (web) return webProblem(url);
  if (type !== 'native') return 'Custom schemes are for mobile and desktop apps.';
  return url.protocol.slice(0, -1).includes('.') ? null : 'A custom scheme needs a dot, like com.example.app.';
}
