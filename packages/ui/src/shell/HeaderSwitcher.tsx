import { LayoutGrid } from 'lucide-react';
import { Button } from '../components/button.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../components/dropdown-menu.js';

export interface SwitcherEntry {
  label: string;
  href: string;
  current: boolean;
}

// The top bar's app switcher: links to this workspace's other apps (full page loads; SSO signs the person in).
// With fewer than two entries there is nothing to switch to, so nothing renders.
export function AppSwitcher({ entries }: { entries: SwitcherEntry[] }) {
  if (entries.length < 2) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Switch app">
          <LayoutGrid aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80">
        <DropdownMenuLabel>Apps</DropdownMenuLabel>
        {entries.map((entry) => (
          <DropdownMenuItem key={entry.href} asChild>
            <a href={entry.href} {...(entry.current ? { 'aria-current': 'page' as const } : {})}>
              {entry.label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
