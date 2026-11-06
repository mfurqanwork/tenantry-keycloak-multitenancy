import type { NavItem } from '@tenantry/ui';

export interface SearchSources {
  // The menu the person sees: only pages they may open.
  pages: NavItem[];
  people: { userId: string; email: string | null; displayName: string | null }[];
  projects: { id: string; name: string }[];
}

export interface Hit {
  label: string;
  detail?: string;
  // Where it opens; none for a person when People is not the searcher's page.
  href?: string;
  crossApp?: boolean;
  external?: boolean;
}

export interface SearchResults {
  pages: Hit[];
  people: Hit[];
  projects: Hit[];
}

const MAX = 5;

function flatten(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => (item.children ? flatten(item.children) : [item]));
}

function pageHit(item: NavItem): Hit {
  return {
    label: item.label,
    href: item.href,
    ...(item.crossApp ? { crossApp: true } : {}),
    ...(item.external ? { external: true } : {}),
  };
}

// The address of a page with a filter on it, keeping whether it is in the other app.
function filtered(page: NavItem | undefined, value: string): Pick<Hit, 'href' | 'crossApp'> {
  if (!page) return {};
  const separator = page.href.includes('?') ? '&' : '?';
  return {
    href: `${page.href}${separator}q=${encodeURIComponent(value)}`,
    ...(page.crossApp ? { crossApp: true } : {}),
  };
}

// What a query finds among what the person can already see (spec 8.3): pages from their menu, people and
// projects their own token reads. Case is ignored; at most five of each.
export function searchResults(query: string, sources: SearchSources): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { pages: [], people: [], projects: [] };
  const has = (...values: (string | null | undefined)[]) =>
    values.some((v) => typeof v === 'string' && v.toLowerCase().includes(q));
  const pages = flatten(sources.pages);
  const peoplePage = pages.find((p) => p.label === 'People');
  const projectsPage = pages.find((p) => p.label === 'Projects');
  return {
    pages: pages
      .filter((p) => has(p.label))
      .slice(0, MAX)
      .map(pageHit),
    people: sources.people
      .filter((p) => has(p.displayName, p.email))
      .slice(0, MAX)
      .map((p) => {
        const label = p.displayName ?? p.email ?? 'Unnamed';
        return {
          label,
          ...(p.displayName && p.email ? { detail: p.email } : {}),
          ...(p.email ? filtered(peoplePage, p.email) : {}),
        };
      }),
    projects: sources.projects
      .filter((p) => has(p.name))
      .slice(0, MAX)
      .map((p) => ({ label: p.name, ...filtered(projectsPage, p.name) })),
  };
}
