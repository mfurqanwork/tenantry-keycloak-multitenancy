import { z } from 'zod';

export const createProjectBody = z.object({ name: z.string().trim().min(1).max(120) });
export type CreateProjectBody = z.infer<typeof createProjectBody>;
