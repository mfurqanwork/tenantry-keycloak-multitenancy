import type { ReactNode } from 'react';
import type { IconComponent } from '../icon.js';

// An empty list as an invitation: what this space is for, and the one action that fills it.
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: IconComponent;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon size={22} aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
