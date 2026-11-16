import type { ReactNode } from 'react';
import type { IconComponent } from '../icon.js';
import { Page } from './page.js';
import { PageHeader, type Crumb } from './PageHeader.js';
import { TileGrid } from './tiles.js';

interface DashboardPageProps {
  breadcrumbs?: Crumb[];
  title: string;
  icon?: IconComponent;
  actions?: ReactNode;
  description?: ReactNode;
  tiles: ReactNode[];
  activity?: ReactNode;
}

// Key numbers in a tile grid, recent activity below.
export function DashboardPage({ breadcrumbs, title, icon, actions, description, tiles, activity }: DashboardPageProps) {
  return (
    <Page>
      <PageHeader breadcrumbs={breadcrumbs} title={title} icon={icon} actions={actions} description={description} />
      {tiles.length > 0 && <TileGrid>{tiles}</TileGrid>}
      {activity && <section className="flex flex-col gap-4">{activity}</section>}
    </Page>
  );
}
