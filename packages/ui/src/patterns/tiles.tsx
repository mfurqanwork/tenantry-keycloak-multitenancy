import type { ReactNode } from 'react';
import type { IconComponent } from '../icon.js';

// One fact: a small label over its value. The value may be a link (where it leads).
export function StatTile({ label, value, icon: Icon }: { label: string; value: ReactNode; icon?: IconComponent }) {
  return (
    <div data-slot="stat-tile" className="flex h-full flex-col gap-1 rounded-xl border border-border bg-card p-4">
      {Icon && <Icon size={18} aria-hidden="true" className="mb-1 text-muted-foreground" />}
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tracking-tight tabular-nums [&_a]:text-link [&_a]:hover:underline">
        {value}
      </p>
    </div>
  );
}

// Tiles side by side; they wrap on narrow screens.
export function TileGrid({ children }: { children: ReactNode[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {children.map((tile, index) => (
        <li key={index}>{tile}</li>
      ))}
    </ul>
  );
}
