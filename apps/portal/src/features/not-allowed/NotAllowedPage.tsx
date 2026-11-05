import { Link } from '@carbon/react';
import { useWorkspaces } from '@tenantry/app-kit';
import { DashboardPage, StatTile } from '@tenantry/ui';

// Admin is for owners and admins (ADR-0027); anyone else who opens it lands here, with the way back.
export function NotAllowedPage() {
  const web = useWorkspaces().find((w) => w.current)?.webUrl;
  return (
    <DashboardPage
      title="You can't open Admin"
      tiles={[
        <StatTile
          key="why"
          label="Admin"
          value="Owners and admins manage the workspace here. Ask one of them if you need a change."
        />,
        ...(web
          ? [<StatTile key="back" label="Your workspace" value={<Link href={web}>Open Tenantry</Link>} />]
          : []),
      ]}
    />
  );
}
