import type { CarbonIconType } from '@carbon/icons-react';
import type { ReactNode } from 'react';
import { PageHeader, type Crumb } from './PageHeader.js';

interface ListPageProps {
  breadcrumbs?: Crumb[];
  title: string;
  icon?: CarbonIconType;
  description?: ReactNode;
  primaryAction?: ReactNode;
  isEmpty: boolean;
  emptyState: ReactNode;
  children: ReactNode;
}

// A collection: header with the primary action, then the DataTable (children) or the empty state.
export function ListPage({
  breadcrumbs,
  title,
  icon,
  description,
  primaryAction,
  isEmpty,
  emptyState,
  children,
}: ListPageProps) {
  return (
    <div className="tenantry-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        icon={icon}
        description={description}
        actions={primaryAction}
      />
      <div className="tenantry-page__body">{isEmpty ? emptyState : children}</div>
    </div>
  );
}
