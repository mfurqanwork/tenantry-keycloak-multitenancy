import { APP_LIMITS, normaliseUris, uriProblem, userSignIn, type AppType } from '@tenantry/auth';
import { z } from 'zod';

const uriList = z
  .array(z.string())
  .default([])
  .transform(normaliseUris)
  .pipe(z.array(z.string()).max(APP_LIMITS.uris, `Use at most ${String(APP_LIMITS.uris)}.`));

const name = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(APP_LIMITS.nameMax, `Use at most ${String(APP_LIMITS.nameMax)} characters.`);

const fields = { name, redirectUris: uriList, postLogoutRedirectUris: uriList, webOrigins: uriList };
type Fields = { redirectUris: string[]; postLogoutRedirectUris: string[]; webOrigins: string[] };

// The URI rules shared with the portal (packages/auth), reported per field and position.
export function checkUris(body: Fields, type: AppType, ctx: z.RefinementCtx): void {
  const lists = [
    ['redirectUris', 'redirect'],
    ['postLogoutRedirectUris', 'redirect'],
    ['webOrigins', 'origin'],
  ] as const;
  for (const [field, kind] of lists) {
    if (type === 'm2m') {
      if (body[field].length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'Machine-to-machine apps have no redirect URIs.',
        });
      }
      continue;
    }
    body[field].forEach((uri, i) => {
      const message = uriProblem(uri, kind, type);
      if (message) ctx.addIssue({ code: 'custom', path: [field, i], message });
    });
  }
  if (userSignIn(type) && body.redirectUris.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['redirectUris'], message: 'Add at least one redirect URI.' });
  }
}

export const appBody = z
  .object({ ...fields, type: z.enum(['web', 'spa', 'native', 'm2m']) })
  .superRefine((body, ctx) => {
    checkUris(body, body.type, ctx);
  });
export type AppBody = z.infer<typeof appBody>;
