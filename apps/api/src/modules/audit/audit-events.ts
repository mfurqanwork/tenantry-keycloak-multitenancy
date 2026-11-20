import type { EventProps } from '../analytics/analytics.service.js';

// The audit actions worth following in PostHog, and the event each becomes. Labels only: the audit
// metadata's emails and names stay in the audit log. SCIM sync traffic and housekeeping are left out.
const EVENTS: Record<string, { event: string; props?: (metadata: Record<string, unknown>) => EventProps }> = {
  'tenant.created': { event: 'workspace_created' },
  'member.invited': { event: 'member_invited', props: (m) => ({ role: label(m['role']) }) },
  'member.joined': { event: 'invite_accepted' },
  'member.role_changed': { event: 'member_role_changed', props: (m) => ({ role: label(m['to']) }) },
  'member.removed': { event: 'member_removed' },
  'member.left': { event: 'member_left' },
  'project.created': { event: 'project_created' },
  'branding.updated': { event: 'branding_updated', props: () => ({ part: 'colour' }) },
  'branding.logo_updated': { event: 'branding_updated', props: () => ({ part: 'logo' }) },
  'domain.verified': { event: 'domain_verified' },
  'idp.linked': { event: 'identity_provider_connected' },
  'tenant.upgraded': { event: 'workspace_upgraded' },
  'app.registered': { event: 'app_registered' },
  'app.deleted': { event: 'app_deleted' },
  'app.token_checked': { event: 'app_token_checked', props: (m) => ({ ok: m['ok'] === true }) },
  'security.updated': { event: 'security_settings_updated' },
  'scim.token_created': { event: 'scim_enabled' },
  'console.granted': { event: 'console_access_granted' },
};

// A short, safe label: roles and similar codes only, never free text.
function label(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z_-]{1,30}$/i.test(value) ? value : null;
}

export function auditEvent(action: string, metadata: Record<string, unknown> = {}): { event: string; props: EventProps } | null {
  const spec = EVENTS[action];
  return spec ? { event: spec.event, props: spec.props?.(metadata) ?? {} } : null;
}
