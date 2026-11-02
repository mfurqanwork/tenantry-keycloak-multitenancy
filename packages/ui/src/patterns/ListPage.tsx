import type { ReactNode } from 'react';
import { PageHeader, type Crumb } from './PageHeader.js';

interface ListPageProps {
  breadcrumbs?: Crumb[];
  title: string;
  primaryAction?: ReactNode;
  isEmpty: boolean;
  emptyState: ReactNode;
  children: ReactNode;
}

// A collection: header with the primary action, then the DataTable (children) or the empty state.
export function ListPage({
  breadcrumbs,
  title,
  primaryAction,
  isEmpty,
  emptyState,
  children,
}: ListPageProps) {
  return (
    <div className="tenantry-page">
      <PageHeader breadcrumbs={breadcrumbs} title={title} actions={primaryAction} />
      <div className="tenantry-page__body">{isEmpty ? emptyState : children}</div>
    </div>
  );
}
