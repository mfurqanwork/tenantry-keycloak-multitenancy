import { SECURITY_DEFAULTS } from '@tenantry/auth';
import { describe, expect, it } from 'vitest';
import { mergeSecurity, secondStepRequirements, securityRealmPatch } from './security.js';
import { loadRealmTemplate, TEMPLATE_VERSION } from './templates.js';

const vars = {
  displayName: 'Initech',
  webOrigin: 'http://initech.tenantry.localhost:8080',
  portalOrigin: 'http://initech.portal.tenantry.localhost:8080',
  smtp: { host: 'mailpit', port: '1025', from: 'no-reply@tenantry.localhost' },
  allowHttpRedirects: true,
};

describe('security settings in Keycloak terms', () => {
  it('writes the template defaults back as the template has them', () => {
    const t = loadRealmTemplate(TEMPLATE_VERSION, vars);
    expect(securityRealmPatch(SECURITY_DEFAULTS)).toEqual({
      passwordPolicy: 'length(12) and notUsername and notEmail',
      ssoSessionIdleTimeout: 1800,
      ssoSessionMaxLifespan: 36000,
      bruteForceProtected: true,
      failureFactor: 10,
      waitIncrementSeconds: 900,
      maxFailureWaitSeconds: 900,
    });
    for (const key of ['passwordPolicy', 'ssoSessionIdleTimeout', 'ssoSessionMaxLifespan', 'failureFactor']) {
      expect(securityRealmPatch(SECURITY_DEFAULTS)[key]).toEqual(t.realm[key]);
    }
  });

  it('adds password history and expiry only when set', () => {
    const patch = securityRealmPatch({
      ...SECURITY_DEFAULTS,
      passwordMinLength: 16,
      passwordHistory: 5,
      passwordExpiryDays: 90,
      sessionIdleMinutes: 15,
      sessionMaxHours: 1,
      lockoutFailures: 3,
      lockoutWaitMinutes: 1,
    });
    expect(patch).toMatchObject({
      passwordPolicy:
        'length(16) and notUsername and notEmail and passwordHistory(5) and forceExpiredPasswordChange(90)',
      ssoSessionIdleTimeout: 900,
      ssoSessionMaxLifespan: 3600,
      failureFactor: 3,
      waitIncrementSeconds: 60,
      maxFailureWaitSeconds: 60,
    });
  });

  it("merges a tenant's settings over the template, and leaves it alone without any", () => {
    const t = loadRealmTemplate(TEMPLATE_VERSION, vars);
    expect(mergeSecurity(t, null)).toEqual(t);
    const merged = mergeSecurity(t, { ...SECURITY_DEFAULTS, twoStep: 'required', passwordMinLength: 20 });
    expect(merged.twoStep).toBe('required');
    expect(merged.realm['passwordPolicy']).toBe('length(20) and notUsername and notEmail');
    expect(merged.realm['loginTheme']).toBe('tenantry');
  });

  it('turns the two-step choice into requirements on the built-in browser flow', () => {
    const step = loadRealmTemplate(TEMPLATE_VERSION, vars).secondStep;
    expect(secondStepRequirements(step, 'off')).toEqual({ 'Browser - Conditional 2FA': 'DISABLED' });
    expect(secondStepRequirements(step, 'optional')).toEqual({
      'Browser - Conditional 2FA': 'CONDITIONAL',
      'Condition - user configured': 'REQUIRED',
      'Condition - credential': 'REQUIRED',
      'OTP Form': 'ALTERNATIVE',
      'WebAuthn Authenticator': 'ALTERNATIVE',
      'Recovery Authentication Code Form': 'ALTERNATIVE',
    });
    expect(secondStepRequirements(step, 'required')).toEqual({
      'Browser - Conditional 2FA': 'REQUIRED',
      'Condition - user configured': 'DISABLED',
      'Condition - credential': 'DISABLED',
      'OTP Form': 'REQUIRED',
      'WebAuthn Authenticator': 'DISABLED',
      'Recovery Authentication Code Form': 'DISABLED',
    });
  });
});
