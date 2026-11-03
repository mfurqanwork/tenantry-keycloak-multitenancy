import { Link, Tile } from '@carbon/react';
import { ROLE_LABELS, RouterLink, useMe } from '@tenantry/app-kit';
import { DashboardPage } from '@tenantry/ui';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Tile className="tenantry-stat">
      <p className="tenantry-stat__label">{label}</p>
      <p className="tenantry-stat__value">{value}</p>
    </Tile>
  );
}

// The workspace at a glance, and the way to its settings for those who may change them.
export function DashboardRoute() {
  const me = useMe();
  const tiles = [
    <StatTile key="workspace" label="Workspace" value={me.tenant.name} />,
    <StatTile key="role" label="Your role" value={me.role ? ROLE_LABELS[me.role] : 'None'} />,
  ];
  if (me.can('tenant:settings')) {
    tiles.push(
      <Tile key="branding" className="tenantry-stat">
        <p className="tenantry-stat__label">Settings</p>
        <Link as={RouterLink} href="/branding" className="tenantry-stat__value">
          Branding
        </Link>
      </Tile>,
    );
  }
  return <DashboardPage title="Dashboard" tiles={tiles} />;
}
