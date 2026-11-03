import { z } from 'zod';

export const LOGO_MAX_BYTES = 262144;

export const brandingBody = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #0f62fe.')
    .transform((c) => c.toLowerCase())
    .nullable(),
});
export type BrandingBody = z.infer<typeof brandingBody>;
