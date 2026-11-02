import { z } from 'zod';

export const auditQuery = z.object({ before: z.uuid().optional() });
export type AuditQuery = z.infer<typeof auditQuery>;
