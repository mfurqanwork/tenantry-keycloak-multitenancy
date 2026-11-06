import type { AuditEntry } from '@tenantry/db';

export type NotificationKind = 'you' | 'team' | 'workspace' | 'security' | 'expiring' | 'invite';

// Where a notification opens: a page in this workspace's Tenantry or Admin, or another workspace.
export interface NotificationLink {
  app: 'web' | 'admin';
  path: string;
  workspace?: string;
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: NotificationLink;
  createdAt: string;
  unread: boolean;
}

// Who is reading: their own id, and which kinds their role may see (spec 8.4).
export interface Viewer {
  userId: string;
  // Owners and admins (members:invite): the team and the workspace.
  team: boolean;
  // Owners (tenant:settings): security.
  security: boolean;
  workspaceName: string;
}

type Rule = {
  kind: 'you' | 'team' | 'workspace' | 'security';
  // For "you": only when the entry is about the reader.
  aboutReader?: boolean;
  title: (e: AuditEntry, name: (id: string) => string, v: Viewer) => string;
  body?: (e: AuditEntry, name: (id: string) => string) => string;
  link: NotificationLink;
};

// The app's name from an app.* audit entry, when it is there.
const appName = (e: AuditEntry) => (typeof e.metadata['name'] === 'string' ? e.metadata['name'] : null);

const ROLE = { owner: 'Owner', admin: 'Admin', member: 'Member' } as Record<string, string>;
const PEOPLE: NotificationLink = { app: 'admin', path: '/people' };
const by = (e: AuditEntry, name: (id: string) => string) =>
  e.actorUserId ? `${name(e.actorUserId)} changed it.` : 'Changed by your directory or an operator.';

// The audit actions that become notifications, by who sees them.
const RULES: Record<string, Rule> = {
  'member.role_changed': {
    kind: 'you',
    aboutReader: true,
    title: (e) => `Your role is now ${ROLE[String(e.metadata['to'])] ?? 'changed'}`,
    body: by,
    link: { app: 'web', path: '/' },
  },
  'console.granted': {
    kind: 'you',
    aboutReader: true,
    title: () => 'You can open the Keycloak console',
    body: () => 'Open it from Advanced in the menu.',
    link: { app: 'web', path: '/' },
  },
  'console.revoked': {
    kind: 'you',
    aboutReader: true,
    title: () => 'Your Keycloak console access ended',
    body: by,
    link: { app: 'web', path: '/' },
  },
  'member.joined': {
    kind: 'team',
    title: (e, name, v) => `${name(e.target)} joined ${v.workspaceName}`,
    body: (e) => `As ${ROLE[String(e.metadata['role'])] ?? 'a member'}.`,
    link: PEOPLE,
  },
  'member.removed': {
    kind: 'team',
    title: (e, name) => `${name(e.target)} was removed`,
    body: by,
    link: PEOPLE,
  },
  'member.left': { kind: 'team', title: (e, name) => `${name(e.target)} left`, link: PEOPLE },
  'invite.revoked': { kind: 'team', title: () => 'An invite was withdrawn', body: by, link: PEOPLE },
  'scim.user_created': {
    kind: 'team',
    title: (e, name) => `${name(e.target)} was added by your directory`,
    link: PEOPLE,
  },
  'scim.user_deactivated': {
    kind: 'team',
    title: (e, name) => `${name(e.target)} was turned off by your directory`,
    link: PEOPLE,
  },
  'branding.updated': {
    kind: 'workspace',
    title: () => 'The workspace colour changed',
    body: by,
    link: { app: 'admin', path: '/branding' },
  },
  'branding.logo_updated': {
    kind: 'workspace',
    title: () => 'The workspace logo changed',
    body: by,
    link: { app: 'admin', path: '/branding' },
  },
  'app.registered': {
    kind: 'workspace',
    title: (e) =>
      appName(e) ? `Customer app ${appName(e) ?? ''} was registered` : 'A customer app was registered',
    body: by,
    link: { app: 'admin', path: '/advanced/apps' },
  },
  'app.secret_rotated': {
    kind: 'workspace',
    title: (e) => `The secret of ${appName(e) ?? 'a customer app'} was rotated`,
    body: by,
    link: { app: 'admin', path: '/advanced/apps' },
  },
  'tenant.migrated': {
    kind: 'workspace',
    title: (_e, _n, v) => `${v.workspaceName} moved to Enterprise`,
    body: () => 'It now has a realm of its own.',
    link: { app: 'web', path: '/' },
  },
  'security.updated': {
    kind: 'security',
    title: () => 'Sign-in and security settings changed',
    body: by,
    link: { app: 'admin', path: '/security' },
  },
  'scim.token_created': {
    kind: 'security',
    title: () => 'A directory sync token was created',
    body: by,
    link: { app: 'admin', path: '/advanced/scim' },
  },
  'scim.token_revoked': {
    kind: 'security',
    title: () => 'The directory sync token was revoked',
    body: by,
    link: { app: 'admin', path: '/advanced/scim' },
  },
  'idp.linked': {
    kind: 'security',
    title: (e) => `Company login ${e.target} was linked`,
    body: () => 'People with its email domain sign in through it.',
    link: { app: 'admin', path: '/security' },
  },
};

export const NOTIFIED_ACTIONS: readonly string[] = Object.keys(RULES);

// One audit entry as this reader's notification, or null when it is not theirs to see (spec 8.4): never
// their own actions, "you" only about them, team and workspace for owners and admins, security for owners.
export function notificationFor(
  entry: AuditEntry,
  viewer: Viewer,
  names: ReadonlyMap<string, string>,
): Omit<Notification, 'unread'> | null {
  const rule = RULES[entry.action];
  if (!rule) return null;
  if (entry.actorUserId === viewer.userId) return null;
  if (rule.kind === 'you' && (!rule.aboutReader || entry.target !== viewer.userId)) return null;
  if ((rule.kind === 'team' || rule.kind === 'workspace') && !viewer.team) return null;
  if (rule.kind === 'security' && !viewer.security) return null;
  // Nobody needs telling that they joined.
  if (rule.kind === 'team' && entry.target === viewer.userId) return null;
  const name = (id: string) => names.get(id) ?? 'Someone';
  return {
    id: entry.id,
    kind: rule.kind,
    title: rule.title(entry, name, viewer),
    body: rule.body?.(entry, name) ?? '',
    link: rule.link,
    createdAt: entry.createdAt.toISOString(),
  };
}
