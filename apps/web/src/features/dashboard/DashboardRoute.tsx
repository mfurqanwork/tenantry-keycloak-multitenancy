import { Tile } from '@carbon/react';
import { ROLE_LABELS, useMe } from '@tenantry/app-kit';
import { DashboardPage } from '@tenantry/ui';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Tile className="tenantry-stat">
      <p className="tenantry-stat__label">{label}</p>
      <p className="tenantry-stat__value">{value}</p>
    </Tile>
  );
}

// The workspace at a glance, the same facts the portal's dashboard leads with.
export function DashboardRoute() {
  const me = useMe();
  return (
    <DashboardPage
      title="Dashboard"
      tiles={[
        <StatTile key="workspace" label="Workspace" value={me.tenant.name} />,
        <StatTile key="role" label="Your role" value={me.role ? ROLE_LABELS[me.role] : 'None'} />,
      ]}
    />
  );
}
