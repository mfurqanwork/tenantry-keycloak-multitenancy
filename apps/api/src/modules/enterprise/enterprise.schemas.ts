import { z } from 'zod';
import { validateSlug } from '../../common/slug.js';

export const provisionBody = z.object({
  slug: z.string().refine((slug) => validateSlug(slug).ok, {
    message: 'use 3–32 lowercase letters, digits or hyphens, starting with a letter; some names are reserved',
  }),
  name: z.string().trim().min(1).max(80),
  adminEmail: z.email().transform((e) => e.toLowerCase()),
});
export type ProvisionBody = z.infer<typeof provisionBody>;

export const upgradeBody = z.object({
  slug: z.string().max(64).optional(),
  dryRun: z.boolean(),
});
export type UpgradeBody = z.infer<typeof upgradeBody>;
