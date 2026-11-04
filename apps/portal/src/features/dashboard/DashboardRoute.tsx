import { Link } from '@carbon/react';
import { ROLE_LABELS, RouterLink, useMe, useWorkspaces } from '@tenantry/app-kit';
import { DashboardPage, StatTile } from '@tenantry/ui';

// The workspace at a glance, the way to its web app, and its settings for those who may change them.
export function DashboardRoute() {
  const me = useMe();
  const web = useWorkspaces().find((w) => w.current)?.webUrl;
  const tiles = [
    <StatTile key="workspace" label="Workspace" value={me.tenant.name} />,
    <StatTile key="role" label="Your role" value={me.role ? ROLE_LABELS[me.role] : 'None'} />,
  ];
  if (web) {
    tiles.push(<StatTile key="web" label="App" value={<Link href={web}>Open Tenantry</Link>} />);
  }
  if (me.consoleUrl) {
    tiles.push(
      <StatTile
        key="console"
        label="Keycloak console"
        value={<Link href={me.consoleUrl}>Open the Keycloak console</Link>}
      />,
    );
  }
  if (me.can('tenant:settings')) {
    tiles.push(
      <StatTile
        key="branding"
        label="Settings"
        value={
          <Link as={RouterLink} href="/branding">
            Branding
          </Link>
        }
      />,
    );
  }
  return <DashboardPage title="Dashboard" tiles={tiles} />;
}
