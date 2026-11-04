import { z } from 'zod';

export const tokenBody = z
  .object({ expiresInDays: z.union([z.literal(90), z.literal(180), z.literal(365)]) })
  .strict();
export type TokenBody = z.infer<typeof tokenBody>;

export const defaultRoleBody = z.object({ role: z.enum(['member', 'none']) }).strict();
export type DefaultRoleBody = z.infer<typeof defaultRoleBody>;
