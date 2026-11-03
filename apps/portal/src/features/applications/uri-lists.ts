import { normaliseUris, uriProblem, userSignIn, type AppType } from '@tenantry/auth';

// The URI lists an app has, as the register wizard and the edit dialog both ask for them (ADR-0011).
export type ListField = 'redirectUris' | 'postLogoutRedirectUris' | 'webOrigins';
export type UriLists = Record<ListField, string[]>;

export const LISTS: Record<ListField, { label: string; helper: string; kind: 'redirect' | 'origin' }> = {
  redirectUris: {
    label: 'Redirect URI',
    helper: 'Where Keycloak sends people back after they sign in.',
    kind: 'redirect',
  },
  postLogoutRedirectUris: {
    label: 'Post-logout redirect URI',
    helper: 'Optional. Where people land after signing out.',
    kind: 'redirect',
  },
  webOrigins: {
    label: 'Allowed origin',
    helper: "Optional. Left empty, the redirect URIs' origins are allowed.",
    kind: 'origin',
  },
};

// The lists each type is asked for; machine-to-machine apps have none.
export function listsFor(type: AppType): ListField[] {
  if (type === 'm2m') return [];
  return type === 'spa'
    ? ['redirectUris', 'postLogoutRedirectUris', 'webOrigins']
    : ['redirectUris', 'postLogoutRedirectUris'];
}

// One message (or null) per row as the person sees them; an empty list is one empty row.
export function uriProblems(values: string[], field: ListField, type: AppType): (string | null)[] {
  return (values.length === 0 ? [''] : values).map((uri) =>
    uri.trim() === '' ? null : uriProblem(uri.trim(), LISTS[field].kind, type),
  );
}

// Every row is fine, and an app people sign in to has somewhere to send them back.
export function listsReady(type: AppType, lists: UriLists): boolean {
  return (
    (!userSignIn(type) || normaliseUris(lists.redirectUris).length > 0) &&
    listsFor(type).every((field) => uriProblems(lists[field], field, type).every((p) => p === null))
  );
}
