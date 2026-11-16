import { describe, expect, it } from 'vitest';
import { searchResults, type SearchSources } from './search.js';

const sources: SearchSources = {
  pages: [
    { label: 'Home', href: '/' },
    { label: 'Projects', href: '/projects' },
    { label: 'People', href: 'http://acme.portal.test/people', crossApp: true, section: 'Workspace' },
    {
      label: 'Advanced',
      href: '#advanced',
      children: [
        { label: 'Directory sync (SCIM)', href: 'http://acme.portal.test/advanced/scim', crossApp: true },
      ],
    },
  ],
  people: [
    { userId: 'u1', email: 'ada@example.test', displayName: 'Ada Acme' },
    { userId: 'u2', email: 'ben@example.test', displayName: null },
  ],
  projects: [
    { id: 'p1', name: 'Launch plan' },
    { id: 'p2', name: 'Ada onboarding' },
  ],
};

describe('searchResults (spec 8.3)', () => {
  it('finds pages, people and projects, without regard to case', () => {
    const r = searchResults('ADA', sources);
    expect(r.people.map((h) => h.label)).toEqual(['Ada Acme']);
    expect(r.people[0]?.detail).toBe('ada@example.test');
    expect(r.projects.map((h) => h.label)).toEqual(['Ada onboarding']);
    expect(r.pages).toEqual([]);
  });

  it('finds a person by email when they have no name', () => {
    expect(searchResults('ben@', sources).people).toEqual([
      expect.objectContaining({ label: 'ben@example.test' }),
    ]);
  });

  it('finds nothing for an empty query', () => {
    expect(searchResults('   ', sources)).toEqual({ pages: [], people: [], projects: [] });
  });
});
