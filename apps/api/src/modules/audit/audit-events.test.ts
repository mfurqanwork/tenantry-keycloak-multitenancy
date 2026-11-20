import { describe, expect, it } from 'vitest';
import { auditEvent } from './audit-events.js';

describe('audit entries as product events', () => {
  it('keeps labels and drops the emails and names in the audit metadata', () => {
    expect(auditEvent('member.invited', { email: 'ana@example.com', role: 'admin' })).toEqual({
      event: 'member_invited',
      props: { role: 'admin' },
    });
    expect(JSON.stringify(auditEvent('tenant.created', { slug: 'acme', name: 'Acme Ltd' }))).not.toMatch(/acme/i);
    expect(auditEvent('scim.user_updated', {})).toBeNull();
  });
});
