import type { ReactNode } from 'react';
import { PageHeader, type Crumb } from './PageHeader.js';
import { TileGrid } from './tiles.js';

interface DashboardPageProps {
  breadcrumbs?: Crumb[];
  title: string;
  actions?: ReactNode;
  tiles: ReactNode[];
  activity?: ReactNode;
}

// Key numbers in a tile grid, recent activity below.
export function DashboardPage({ breadcrumbs, title, actions, tiles, activity }: DashboardPageProps) {
  return (
    <div className="tenantry-page">
      <PageHeader breadcrumbs={breadcrumbs} title={title} actions={actions} />
      <TileGrid>{tiles}</TileGrid>
      {activity && <section className="tenantry-dashboard__activity">{activity}</section>}
    </div>
  );
}
