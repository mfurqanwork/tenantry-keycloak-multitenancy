import { Link, Tile } from '@carbon/react';
import { ROLE_LABELS, RouterLink, useMe, useWorkspaces } from '@tenantry/app-kit';
import { DashboardPage } from '@tenantry/ui';
import type { ReactNode } from 'react';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Tile className="tenantry-stat">
      <p className="tenantry-stat__label">{label}</p>
      <p className="tenantry-stat__value">{value}</p>
    </Tile>
  );
}

// A tile whose value is where it leads; the link is written like the fact tiles' values.
function LinkTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tile className="tenantry-stat">
      <p className="tenantry-stat__label">{label}</p>
      <p className="tenantry-stat__value">{children}</p>
    </Tile>
  );
}

// The workspace at a glance, the way to its web app, and its settings for those who may change them.
export function DashboardRoute() {
  const me = useMe();
  const web = useWorkspaces().find((w) => w.current)?.webUrl;
  const tiles = [
    <StatTile key="workspace" label="Workspace" value={me.tenant.name} />,
    <StatTile key="role" label="Your role" value={me.role ? ROLE_LABELS[me.role] : 'None'} />,
  ];
  if (web) {
    tiles.push(
      <LinkTile key="web" label="App">
        <Link href={web}>Open Tenantry</Link>
      </LinkTile>,
    );
  }
  if (me.can('tenant:settings')) {
    tiles.push(
      <LinkTile key="branding" label="Settings">
        <Link as={RouterLink} href="/branding">
          Branding
        </Link>
      </LinkTile>,
    );
  }
  return <DashboardPage title="Dashboard" tiles={tiles} />;
}
