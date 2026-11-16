import { Button, Dialog, DialogContent, DialogTitle, Kbd, type NavItem } from '@tenantry/ui';
import { Command } from 'cmdk';
import { AppWindow, Folder, Search as SearchIcon, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApi } from '../api.js';
import { useMe } from '../me.js';
import { searchResults, type Hit, type SearchSources } from './search.js';

type Group = { name: 'Pages' | 'People' | 'Projects'; hits: Hit[] };

const ICONS = { Pages: AppWindow, People: User, Projects: Folder } as const;

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

// Search across the pages, people and projects the person can already see (spec 8.3). A top-bar button,
// and Ctrl+K (Cmd+K on macOS), open it; Escape closes it and puts focus back on the button.
export function WorkspaceSearch({ pages }: { pages: NavItem[] }) {
  const me = useMe();
  const api = useApi();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Omit<SearchSources, 'pages'>>({ people: [], projects: [] });
  const button = useRef<HTMLButtonElement>(null);

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
  const none = query.trim() !== '' && groups.length === 0;

  const setOpenAndReset = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };
  const go = (hit: Hit) => {
    if (!hit.href) return;
    setOpenAndReset(false);
    if (hit.external) window.open(hit.href, '_blank', 'noreferrer');
    else if (hit.crossApp || /^https?:/.test(hit.href)) window.location.assign(hit.href);
    else void navigate(hit.href);
  };

  return (
    <>
      <Button
        ref={button}
        variant="outline"
        size="sm"
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K"
        className="gap-2 text-muted-foreground sm:w-56 sm:justify-start"
        onClick={() => {
          setOpen(true);
        }}
      >
        <SearchIcon aria-hidden="true" />
        <span className="hidden sm:inline">Search</span>
        <Kbd className="ml-auto hidden sm:inline-flex">{isMac() ? '⌘K' : 'Ctrl K'}</Kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpenAndReset}>
        <DialogContent
          aria-describedby={undefined}
          showCloseButton={false}
          className="top-[15vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
          onCloseAutoFocus={(event) => {
            // Opened from the keyboard, Radix would return focus to wherever it was; the button is where
            // search lives.
            event.preventDefault();
            button.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <Command shouldFilter={false} loop label="Search pages, people and projects" className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <Command.Input
                autoFocus
                placeholder="Search pages, people and projects"
                value={query}
                onValueChange={setQuery}
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              {none && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">{`Nothing matches "${query.trim()}".`}</p>
              )}
              {groups.map((group) => {
                const Icon = ICONS[group.name];
                return (
                  <Command.Group
                    key={group.name}
                    heading={group.name}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {group.hits.map((hit) => (
                      <Command.Item
                        key={`${group.name}-${hit.label}-${hit.detail ?? ''}`}
                        value={`${group.name}-${hit.label}-${hit.detail ?? ''}`}
                        disabled={!hit.href}
                        onSelect={() => {
                          go(hit);
                        }}
                        className="flex cursor-default items-center gap-3 rounded-md px-2 py-2 text-sm outline-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                      >
                        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{hit.label}</span>
                        {hit.detail && <span className="ml-auto truncate text-xs text-muted-foreground">{hit.detail}</span>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
