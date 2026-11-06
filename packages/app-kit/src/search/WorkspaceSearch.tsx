import { ComposedModal, HeaderGlobalAction, ModalBody, Search } from '@carbon/react';
import { Application, Folder, Search as SearchIcon, User } from '@carbon/icons-react';
import type { NavItem } from '@tenantry/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useApi } from '../api.js';
import { useMe } from '../me.js';
import { searchResults, type Hit, type SearchSources } from './search.js';

type Group = { name: 'Pages' | 'People' | 'Projects'; hits: Hit[] };

const ICONS = { Pages: Application, People: User, Projects: Folder } as const;

// Search across the pages, people and projects the person can already see (spec 8.3). A header button,
// and Ctrl+K (Cmd+K on macOS), open it.
export function WorkspaceSearch({ pages }: { pages: NavItem[] }) {
  const me = useMe();
  const api = useApi();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [data, setData] = useState<Omit<SearchSources, 'pages'>>({ people: [], projects: [] });
  const field = useRef<HTMLInputElement>(null);

  // Focus the field once the dialog has opened, so typing starts at once.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => field.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Read people and projects when the dialog opens, only where the person may.
  useEffect(() => {
    if (!open) return;
    let current = true;
    const people = me.can('members:read')
      ? api.get<{ members: SearchSources['people'] }>('/api/members').then(
          (r) => r.members,
          () => [],
        )
      : Promise.resolve([]);
    const projects = me.can('projects:read')
      ? api.get<{ projects: SearchSources['projects'] }>('/api/projects').then(
          (r) => r.projects,
          () => [],
        )
      : Promise.resolve([]);
    // Read once per opening.
    void Promise.all([people, projects]).then(([p, j]) => {
      if (current) setData({ people: p, projects: j });
    });
    return () => {
      current = false;
    };
  }, [open]);

  const groups: Group[] = useMemo(() => {
    const r = searchResults(query, { pages, ...data });
    const all: Group[] = [
      { name: 'Pages', hits: r.pages },
      { name: 'People', hits: r.people },
      { name: 'Projects', hits: r.projects },
    ];
    return all.filter((g) => g.hits.length > 0);
  }, [query, pages, data]);
  const flat = groups.flatMap((g) => g.hits);

  const close = () => {
    setOpen(false);
    setQuery('');
    setActive(0);
  };
  const go = (hit: Hit | undefined) => {
    if (!hit?.href) return;
    close();
    if (hit.external) window.open(hit.href, '_blank', 'noreferrer');
    else if (hit.crossApp || /^https?:/.test(hit.href)) window.location.assign(hit.href);
    else void navigate(hit.href);
  };

  return (
    <>
      <HeaderGlobalAction
        aria-label="Search"
        onClick={() => {
          setOpen(true);
        }}
      >
        <SearchIcon size={20} />
      </HeaderGlobalAction>
      {/* At the page's level: inside the always-dark header it would take the header's theme, and sit
          under the side nav. */}
      {createPortal(
        <ComposedModal open={open} onClose={close} size="sm" aria-label="Search" className="tenantry-search">
          <ModalBody>
            {open && (
              <Search
                ref={field}
                autoFocus
                size="lg"
                labelText="Search pages, people and projects"
                placeholder="Search pages, people and projects"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={(event) => {
                  // Carbon's field takes Esc to clear itself; here Esc closes the search.
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    close();
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActive((i) => Math.min(i + 1, flat.length - 1));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActive((i) => Math.max(i - 1, 0));
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    go(flat[active]);
                  }
                }}
              />
            )}
            {query.trim() && flat.length === 0 && (
              <p className="tenantry-search__none">{`Nothing matches "${query.trim()}".`}</p>
            )}
            {groups.map((group) => {
              const Icon = ICONS[group.name];
              return (
                <div key={group.name} role="group" aria-label={group.name} className="tenantry-search__group">
                  <p className="tenantry-search__heading">{group.name}</p>
                  <ul>
                    {group.hits.map((hit) => {
                      const index = flat.indexOf(hit);
                      return (
                        <li key={`${group.name}-${hit.label}-${hit.detail ?? ''}`}>
                          <button
                            type="button"
                            className="tenantry-search__hit"
                            data-active={index === active ? 'true' : 'false'}
                            disabled={!hit.href}
                            onMouseEnter={() => {
                              setActive(index);
                            }}
                            onClick={() => {
                              go(hit);
                            }}
                          >
                            <Icon size={16} aria-hidden="true" />
                            <span className="tenantry-search__label">{hit.label}</span>
                            {hit.detail && <span className="tenantry-search__detail">{hit.detail}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </ModalBody>
        </ComposedModal>,
        document.body,
      )}
    </>
  );
}
