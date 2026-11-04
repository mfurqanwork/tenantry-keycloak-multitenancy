import { securityProblems, type SecuritySettings } from '@tenantry/auth';
import { z } from 'zod';

// The bounds live in @tenantry/auth, so the portal's form says exactly what this says.
export const securityBody = z
  .object({
    twoStep: z.enum(['off', 'optional', 'required']),
    passwordMinLength: z.number(),
    passwordHistory: z.number(),
    passwordExpiryDays: z.number(),
    sessionIdleMinutes: z.number(),
    sessionMaxHours: z.number(),
    lockoutFailures: z.number(),
    lockoutWaitMinutes: z.number(),
    scimDefaultRole: z.enum(['member', 'none']),
  })
  .strict()
  .superRefine((s, ctx) => {
    for (const [field, message] of Object.entries(securityProblems(s))) {
      ctx.addIssue({ code: 'custom', path: [field], message });
    }
  }) satisfies z.ZodType<SecuritySettings>;
