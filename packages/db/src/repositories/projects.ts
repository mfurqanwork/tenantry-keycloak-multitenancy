import { desc, eq } from 'drizzle-orm';
import { projects } from '../schema/index.js';
import type { TenantTx } from '../tenant-tx.js';

export interface ProjectRecord {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: Date;
}

const columns = {
  id: projects.id,
  name: projects.name,
  ownerUserId: projects.ownerUserId,
  createdAt: projects.createdAt,
};

// No tenant filter here on purpose: row-level security supplies it.
export function listProjects(tx: TenantTx): Promise<ProjectRecord[]> {
  return tx.select(columns).from(projects).orderBy(desc(projects.createdAt));
}

export async function getProject(tx: TenantTx, id: string): Promise<ProjectRecord | null> {
  const [row] = await tx.select(columns).from(projects).where(eq(projects.id, id));
  return row ?? null;
}

export async function createProject(
  tx: TenantTx,
  input: { name: string; ownerUserId: string },
): Promise<ProjectRecord> {
  const [row] = await tx.insert(projects).values(input).returning(columns);
  if (!row) throw new Error('insert returned no row');
  return row;
}
