import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import * as schema from './schema/index.js';

export type Db = NodePgDatabase<typeof schema>;

export function createDb(pool: pg.Pool): Db {
  return drizzle(pool, { schema });
}
