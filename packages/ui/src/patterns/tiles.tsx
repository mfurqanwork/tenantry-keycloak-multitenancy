import { Column, Grid, Tile } from '@carbon/react';
import type { ReactNode } from 'react';

// One fact: a small label over its value. The value may be a link (where it leads).
export function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Tile className="tenantry-stat">
      <p className="tenantry-stat__label">{label}</p>
      <p className="tenantry-stat__value">{value}</p>
    </Tile>
  );
}

// Tiles side by side, four columns each on Carbon's grid; they wrap on narrow screens.
export function TileGrid({ children }: { children: ReactNode[] }) {
  return (
    <Grid narrow className="tenantry-dashboard__tiles">
      {children.map((tile, index) => (
        <Column key={index} sm={4} md={4} lg={4}>
          {tile}
        </Column>
      ))}
    </Grid>
  );
}
