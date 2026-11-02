import { describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import { pingDatabase } from './client.js';

const poolWith = (query: ReturnType<typeof vi.fn>) => ({ query }) as unknown as pg.Pool;

describe('pingDatabase', () => {
  it('resolves when the database answers', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
    await expect(pingDatabase(poolWith(query))).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith('select 1');
  });

  it('rejects when the database is unreachable', async () => {
    const query = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(pingDatabase(poolWith(query))).rejects.toThrow('ECONNREFUSED');
  });
});
