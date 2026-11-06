// The API's address rule (signup.schemas.ts): 3–32 lowercase letters, digits or hyphens, starting with a
// letter, and not ending in a hyphen.
const SLUG = /^[a-z][a-z0-9-]{2,31}$/;

// What a visitor types in "Go to your workspace": a name, an address, or a pasted URL from either app.
// Returns the workspace's slug, or null when it can't be one.
export function workspaceFromInput(input: string, baseDomain: string): string | null {
  let host = input.trim().toLowerCase();
  host = host
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '');
  const base = baseDomain.toLowerCase();
  if (host.endsWith(`.${base}`)) host = host.slice(0, -(base.length + 1));
  const slug = host.split('.')[0] ?? '';
  return SLUG.test(slug) && !slug.endsWith('-') ? slug : null;
}
