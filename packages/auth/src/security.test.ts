import { describe, expect, it } from 'vitest';
import { SECURITY_BOUNDS, SECURITY_DEFAULTS, securityProblems, type SecuritySettings } from './security.js';

const NUMERIC = Object.keys(SECURITY_BOUNDS) as (keyof typeof SECURITY_BOUNDS)[];

describe('security settings', () => {
  it('starts from the template defaults, which are fine', () => {
    expect(SECURITY_DEFAULTS).toEqual({
      twoStep: 'optional',
      passwordMinLength: 12,
      passwordHistory: 0,
      passwordExpiryDays: 0,
      sessionIdleMinutes: 30,
      sessionMaxHours: 10,
      lockoutFailures: 10,
      lockoutWaitMinutes: 15,
      scimDefaultRole: 'member',
    });
    expect(securityProblems(SECURITY_DEFAULTS)).toEqual({});
  });

  it('has the bounds the spec sets', () => {
    expect(SECURITY_BOUNDS).toEqual({
      passwordMinLength: { min: 12, max: 64 },
      passwordHistory: { min: 0, max: 24 },
      passwordExpiryDays: { min: 0, max: 365 },
      sessionIdleMinutes: { min: 15, max: 720 },
      sessionMaxHours: { min: 1, max: 24 },
      lockoutFailures: { min: 3, max: 20 },
      lockoutWaitMinutes: { min: 1, max: 60 },
    });
  });

  it.each(NUMERIC)('accepts %s at its limits and refuses just past them', (field) => {
    const { min, max } = SECURITY_BOUNDS[field];
    // A long enough session so that idle limits are judged on their own.
    const base: SecuritySettings = { ...SECURITY_DEFAULTS, sessionMaxHours: 24 };
    for (const ok of [min, max]) expect(securityProblems({ ...base, [field]: ok })[field]).toBeUndefined();
    for (const bad of [min - 1, max + 1, min + 0.5]) {
      expect(securityProblems({ ...base, [field]: bad })[field]).toBe(
        `Use a whole number from ${String(min)} to ${String(max)}.`,
      );
    }
  });

  it('refuses an idle time longer than the session may last', () => {
    expect(securityProblems({ ...SECURITY_DEFAULTS, sessionIdleMinutes: 720, sessionMaxHours: 1 })).toEqual({
      sessionIdleMinutes: 'A session cannot sit idle longer than it may last.',
    });
    expect(securityProblems({ ...SECURITY_DEFAULTS, sessionIdleMinutes: 60, sessionMaxHours: 1 })).toEqual(
      {},
    );
  });
});
