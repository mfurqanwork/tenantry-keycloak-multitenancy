import { describe, expect, it } from 'vitest';
import { COMPANY, PEOPLE, WORKSPACES } from './seed.js';

describe('the demo seed', () => {
  it('the demo workspace is Pengopal, in the Pengopal blue', () => {
    expect(WORKSPACES[0]).toEqual({
      slug: 'pengopal',
      name: 'Pengopal',
      color: '#2b77c0',
      owner: 'ada@example.test',
    });
    expect(COMPANY.tenant).toBe('pengopal');
  });

  it('every person belongs only to seeded workspaces', () => {
    const slugs: string[] = WORKSPACES.map((w) => w.slug);
    for (const person of PEOPLE) {
      for (const slug of Object.keys(person.workspaces)) expect(slugs).toContain(slug);
    }
  });
});
