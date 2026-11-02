import { z } from 'zod';
import { validateSlug } from './slug.js';

export const signupBody = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().refine((slug) => validateSlug(slug).ok, {
    message: 'use 3–32 lowercase letters, digits or hyphens, starting with a letter; some names are reserved',
  }),
});
export type SignupBody = z.infer<typeof signupBody>;

export const availabilityQuery = z.object({ slug: z.string().max(64) });
export type AvailabilityQuery = z.infer<typeof availabilityQuery>;
