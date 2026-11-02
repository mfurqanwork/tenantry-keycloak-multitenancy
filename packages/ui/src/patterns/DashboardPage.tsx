import { Column, Grid } from '@carbon/react';
import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader.js';

interface DashboardPageProps {
  title: string;
  tiles: ReactNode[];
  activity?: ReactNode;
}

// Key numbers in a tile grid, recent activity below.
export function DashboardPage({ title, tiles, activity }: DashboardPageProps) {
  return (
    <div className="tenantry-page">
      <PageHeader title={title} />
      <Grid narrow className="tenantry-dashboard__tiles">
        {tiles.map((tile, index) => (
          <Column key={index} sm={4} md={4} lg={4}>
            {tile}
          </Column>
        ))}
      </Grid>
      {activity && <section className="tenantry-dashboard__activity">{activity}</section>}
    </div>
  );
}
