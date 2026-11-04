// An enterprise realm's sign-in rules, as its owners set them (Phase 5a). Shared by the API and the
// portal, so the form says what the API would say.
export type TwoStep = 'off' | 'optional' | 'required';
export type ScimDefaultRole = 'member' | 'none';

export interface SecuritySettings {
  twoStep: TwoStep;
  passwordMinLength: number;
  passwordHistory: number;
  // 0 = passwords never expire.
  passwordExpiryDays: number;
  sessionIdleMinutes: number;
  sessionMaxHours: number;
  lockoutFailures: number;
  lockoutWaitMinutes: number;
  // The role a person created through SCIM gets; 'none' leaves it to an invite or an admin.
  scimDefaultRole: ScimDefaultRole;
}

// The realm template's own values (enterprise-realm.v2 and later).
export const SECURITY_DEFAULTS: SecuritySettings = {
  twoStep: 'optional',
  passwordMinLength: 12,
  passwordHistory: 0,
  passwordExpiryDays: 0,
  sessionIdleMinutes: 30,
  sessionMaxHours: 10,
  lockoutFailures: 10,
  lockoutWaitMinutes: 15,
  scimDefaultRole: 'member',
};

type NumericSetting = Exclude<keyof SecuritySettings, 'twoStep' | 'scimDefaultRole'>;

export const SECURITY_BOUNDS: Record<NumericSetting, { min: number; max: number }> = {
  passwordMinLength: { min: 12, max: 64 },
  passwordHistory: { min: 0, max: 24 },
  passwordExpiryDays: { min: 0, max: 365 },
  sessionIdleMinutes: { min: 15, max: 720 },
  sessionMaxHours: { min: 1, max: 24 },
  lockoutFailures: { min: 3, max: 20 },
  lockoutWaitMinutes: { min: 1, max: 60 },
};

// The message for each setting that is out of bounds; empty when all is well.
export function securityProblems(s: SecuritySettings): Partial<Record<keyof SecuritySettings, string>> {
  const problems: Partial<Record<keyof SecuritySettings, string>> = {};
  for (const [field, { min, max }] of Object.entries(SECURITY_BOUNDS) as [
    NumericSetting,
    { min: number; max: number },
  ][]) {
    const value = s[field];
    if (!Number.isInteger(value) || value < min || value > max) {
      problems[field] = `Use a whole number from ${String(min)} to ${String(max)}.`;
    }
  }
  if (
    !problems.sessionIdleMinutes &&
    !problems.sessionMaxHours &&
    s.sessionIdleMinutes > s.sessionMaxHours * 60
  ) {
    problems.sessionIdleMinutes = 'A session cannot sit idle longer than it may last.';
  }
  return problems;
}
