import { Link, Tile } from '@carbon/react';
import { DashboardPage } from '@tenantry/ui';
import { GoToWorkspace } from '../welcome/GoToWorkspace.js';

// An address with no workspace behind it: unknown, failed or not yet created.
export function NotFoundPage({ signupUrl, baseDomain }: { signupUrl: string; baseDomain: string }) {
  return (
    <DashboardPage
      title="Workspace not found"
      description="There is no workspace at this address. Check it, or try another."
      tiles={[
        <Tile key="go" className="tenantry-welcome__tile">
          <GoToWorkspace baseDomain={baseDomain} />
        </Tile>,
        <Tile key="back" className="tenantry-welcome__tile">
          <Link href={signupUrl}>Go to the welcome page</Link>
        </Tile>,
      ]}
    />
  );
}
