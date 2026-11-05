import { Link, Stack, Tile } from '@carbon/react';
import { DashboardPage } from '@tenantry/ui';
import { GoToWorkspace, workspaceUrl } from './GoToWorkspace.js';

// The base domain's front page (spec §2.1): what Tenantry is, and the two ways in. No sign-in until one is chosen.
export function WelcomeRoute({
  baseDomain,
  demoWorkspaces,
}: {
  baseDomain: string;
  demoWorkspaces: string[];
}) {
  const tiles = [
    <Tile key="create" className="tenantry-welcome__tile">
      <Stack gap={5}>
        <h2 className="tenantry-welcome__heading">New here?</h2>
        <p>Create a workspace for your team in one step.</p>
        <Link href="/signup">Create a workspace</Link>
      </Stack>
    </Tile>,
    <Tile key="go" className="tenantry-welcome__tile">
      <Stack gap={5}>
        <h2 className="tenantry-welcome__heading">Go to your workspace</h2>
        <GoToWorkspace baseDomain={baseDomain} />
      </Stack>
    </Tile>,
  ];
  if (demoWorkspaces.length > 0) {
    tiles.push(
      <Tile key="demo" className="tenantry-welcome__tile">
        <Stack gap={5}>
          <h2 className="tenantry-welcome__heading">Try a demo workspace</h2>
          <ul className="tenantry-welcome__demos">
            {demoWorkspaces.map((slug) => (
              <li key={slug}>
                <Link href={workspaceUrl(slug, baseDomain)}>{slug}</Link>
              </li>
            ))}
          </ul>
        </Stack>
      </Tile>,
    );
  }
  return (
    <DashboardPage
      title="Tenantry"
      description="Sign-in, teams and branding for every customer workspace, built on Keycloak."
      tiles={tiles}
    />
  );
}
