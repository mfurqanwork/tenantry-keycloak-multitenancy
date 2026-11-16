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
    const tiles = screen.getAllByRole('listitem');
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveTextContent(/^WorkspaceAcme$/);
    expect(screen.getByRole('link', { name: 'Open Tenantry' })).toHaveAttribute('href', '/x');
  });
});
