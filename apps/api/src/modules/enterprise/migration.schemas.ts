import { z } from 'zod';

const slug = z.string().min(1).max(64);

export const migrateBody = z.object({ slug, dryRun: z.boolean().default(false) }).strict();
export type MigrateBody = z.infer<typeof migrateBody>;

export const slugBody = z.object({ slug }).strict();
export type SlugBody = z.infer<typeof slugBody>;

export const idpSecretBody = z.object({ secret: z.string().min(1).max(4096) }).strict();
export type IdpSecretBody = z.infer<typeof idpSecretBody>;
