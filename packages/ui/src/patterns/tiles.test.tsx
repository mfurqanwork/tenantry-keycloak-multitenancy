import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatTile, TileGrid } from './tiles.js';

describe('tiles', () => {
  it('shows a fact as a label over its value, the value may be a link', () => {
    render(
      <TileGrid>
        {[
          <StatTile key="w" label="Workspace" value="Acme" />,
          <StatTile key="a" label="App" value={<a href="/x">Open Tenantry</a>} />,
        ]}
      </TileGrid>,
    );
    expect(screen.getByText('Workspace')).toHaveClass('tenantry-stat__label');
    expect(screen.getByText('Acme')).toHaveClass('tenantry-stat__value');
    expect(screen.getByRole('link', { name: 'Open Tenantry' })).toHaveAttribute('href', '/x');
    expect(document.querySelectorAll('.tenantry-dashboard__tiles .tenantry-stat')).toHaveLength(2);
  });
});
