import { ROLE_LABELS, useMe } from '@tenantry/app-kit';
import { DashboardPage, StatTile } from '@tenantry/ui';

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
