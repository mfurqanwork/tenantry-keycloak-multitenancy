import type { ReactNode } from 'react';
import type { IconComponent } from '../icon.js';
import { Page } from './page.js';
import { PageHeader, type Crumb } from './PageHeader.js';

interface ListPageProps {
  breadcrumbs?: Crumb[];
  title: string;
  icon?: IconComponent;
  description?: ReactNode;
  primaryAction?: ReactNode;
  isEmpty: boolean;
  emptyState: ReactNode;
  children: ReactNode;
}

// A collection: header with the primary action, then the table (children) or the empty state.
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
    <Page>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        icon={icon}
        description={description}
        actions={primaryAction}
      />
      <div className="flex flex-col gap-4">{isEmpty ? emptyState : children}</div>
    </Page>
  );
}
