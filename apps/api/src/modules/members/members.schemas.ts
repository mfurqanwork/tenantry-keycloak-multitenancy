import { z } from 'zod';

const role = z.enum(['owner', 'admin', 'member']);

export const inviteBody = z.object({ email: z.email().max(254), role });
export type InviteBody = z.infer<typeof inviteBody>;

export const changeRoleBody = z.object({ role });
export type ChangeRoleBody = z.infer<typeof changeRoleBody>;
