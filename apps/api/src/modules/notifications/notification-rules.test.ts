import { describe, expect, it } from 'vitest';
import { notificationFor, NOTIFIED_ACTIONS, type Viewer } from './notification-rules.js';

const entry = (
  action: string,
  target: string,
  metadata: Record<string, unknown> = {},
  actorUserId = 'u-actor',
) => ({
  id: `e-${action}`,
  actorUserId,
  action,
  target,
  metadata,
  createdAt: new Date('2026-11-08T10:00:00Z'),
});
const names = new Map([
  ['u-me', 'Ada Acme'],
  ['u-ben', 'Ben Acme'],
  ['u-actor', 'Gil Admin'],
]);
const owner: Viewer = { userId: 'u-me', team: true, security: true, workspaceName: 'Acme' };
const admin: Viewer = { ...owner, security: false };
const member: Viewer = { userId: 'u-me', team: false, security: false, workspaceName: 'Acme' };
const of = (v: Viewer, e: ReturnType<typeof entry>) => notificationFor(e, v, names);

describe('notification rules (spec 8.4)', () => {
  it('tells you about your own role and console access', () => {
    expect(of(member, entry('member.role_changed', 'u-me', { from: 'member', to: 'admin' }))).toMatchObject({
      kind: 'you',
      title: 'Your role is now Admin',
      body: 'Gil Admin changed it.',
    });
    expect(of(member, entry('console.granted', 'u-me'))).toMatchObject({ kind: 'you' });
    expect(of(member, entry('console.revoked', 'u-me'))).toMatchObject({ kind: 'you' });
  });

  it("never shows a member someone else's role change or a team event", () => {
    expect(of(member, entry('member.role_changed', 'u-ben', { to: 'admin' }))).toBeNull();
    expect(of(member, entry('member.removed', 'u-ben'))).toBeNull();
    expect(of(member, entry('member.joined', 'u-ben'))).toBeNull();
    expect(of(member, entry('branding.updated', 't1'))).toBeNull();
    expect(of(member, entry('security.updated', 't1'))).toBeNull();
  });

  it('shows owners and admins the team and the workspace', () => {
    expect(of(admin, entry('member.joined', 'u-ben', { role: 'member' }))).toMatchObject({
      kind: 'team',
      title: 'Ben Acme joined Acme',
      link: { app: 'admin', path: '/people' },
    });
    expect(of(admin, entry('member.removed', 'u-ben'))).toMatchObject({ kind: 'team' });
    expect(of(admin, entry('scim.user_created', 'u-ben'))).toMatchObject({ kind: 'team' });
    expect(of(admin, entry('branding.updated', 't1'))).toMatchObject({
      kind: 'workspace',
      link: { app: 'admin', path: '/branding' },
    });
    expect(of(admin, entry('app.registered', 'a1', { name: 'Billing' }))).toMatchObject({
      kind: 'workspace',
      title: 'Customer app Billing was registered',
    });
    expect(of(admin, entry('tenant.migrated', 't1'))).toMatchObject({ title: 'Acme moved to Enterprise' });
  });

  it('shows security events to owners only', () => {
    expect(of(owner, entry('security.updated', 't1'))).toMatchObject({
      kind: 'security',
      link: { app: 'admin', path: '/security' },
    });
    expect(of(owner, entry('scim.token_revoked', 't1'))).toMatchObject({ kind: 'security' });
    expect(of(admin, entry('security.updated', 't1'))).toBeNull();
  });

  it('leaves out what you did yourself', () => {
    expect(of(owner, entry('branding.updated', 't1', {}, 'u-me'))).toBeNull();
    expect(of(owner, entry('member.joined', 'u-me', {}, null as unknown as string))).toBeNull();
  });

  it('asks the database only for the actions it knows', () => {
    expect(NOTIFIED_ACTIONS).toContain('member.joined');
    expect(NOTIFIED_ACTIONS).not.toContain('project.created');
    expect(NOTIFIED_ACTIONS).not.toContain('app.token_checked');
  });
});
