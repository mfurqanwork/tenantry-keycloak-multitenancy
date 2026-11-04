import type { SecuritySettings, TwoStep } from '@tenantry/auth';
import type { RealmTemplate, SecondStep } from './templates.js';

// An owner's sign-in rules as Keycloak realm settings (Phase 5a). Brute-force protection stays on.
export function securityRealmPatch(s: SecuritySettings): Record<string, unknown> {
  const policy = [`length(${String(s.passwordMinLength)})`, 'notUsername', 'notEmail'];
  if (s.passwordHistory > 0) policy.push(`passwordHistory(${String(s.passwordHistory)})`);
  if (s.passwordExpiryDays > 0) policy.push(`forceExpiredPasswordChange(${String(s.passwordExpiryDays)})`);
  return {
    passwordPolicy: policy.join(' and '),
    ssoSessionIdleTimeout: s.sessionIdleMinutes * 60,
    ssoSessionMaxLifespan: s.sessionMaxHours * 3600,
    bruteForceProtected: true,
    failureFactor: s.lockoutFailures,
    waitIncrementSeconds: s.lockoutWaitMinutes * 60,
    maxFailureWaitSeconds: s.lockoutWaitMinutes * 60,
  };
}

// The template as this tenant runs it: its own settings over the template's defaults. Upgrades compare
// against this, so a tenant's choices are never reported as drift.
export function mergeSecurity(template: RealmTemplate, s: SecuritySettings | null): RealmTemplate {
  if (!s) return template;
  return { ...template, realm: { ...template.realm, ...securityRealmPatch(s) }, twoStep: s.twoStep };
}

// Requirements, by execution display name, for the second step of the built-in browser flow.
// Keycloak 26.8.1 refuses a required step of alternatives, so "required" means the authenticator app.
export function secondStepRequirements(step: SecondStep, twoStep: TwoStep): Record<string, string> {
  if (twoStep === 'off') return { [step.subflow]: 'DISABLED' };
  const required = twoStep === 'required';
  return {
    [step.subflow]: required ? 'REQUIRED' : 'CONDITIONAL',
    ...Object.fromEntries(step.conditions.map((c) => [c, required ? 'DISABLED' : 'REQUIRED'])),
    [step.otp]: required ? 'REQUIRED' : 'ALTERNATIVE',
    ...Object.fromEntries(step.others.map((o) => [o, required ? 'DISABLED' : 'ALTERNATIVE'])),
  };
}
