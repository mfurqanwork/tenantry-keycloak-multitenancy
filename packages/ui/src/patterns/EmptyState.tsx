import type { CarbonIconType } from '@carbon/icons-react';
import type { ReactNode } from 'react';

// An empty list as an invitation: what this space is for, and the one action that fills it.
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: CarbonIconType;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="tenantry-empty">
      <Icon size={32} aria-hidden="true" className="tenantry-empty__icon" />
      <h2 className="tenantry-empty__title">{title}</h2>
      <p className="tenantry-empty__body">{body}</p>
      {action && <div className="tenantry-empty__action">{action}</div>}
    </div>
  );
}
