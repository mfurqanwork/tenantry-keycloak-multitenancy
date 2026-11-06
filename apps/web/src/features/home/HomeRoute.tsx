import {
  Button,
  Link,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tile,
} from '@carbon/react';
import { ArrowRight, Email, Folder, FolderOpen, UserMultiple } from '@carbon/icons-react';
import {
  adminUrl,
  ApiErrorNotification,
  RouterLink,
  useApi,
  useBranding,
  useMe,
  useResource,
  useWorkspaces,
} from '@tenantry/app-kit';
import { DashboardPage, EmptyState, StatTile } from '@tenantry/ui';
import { Checklist } from './Checklist.js';

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

const RECENT = 5;

// "Good morning" before noon, "Good afternoon" before six, "Good evening" after, by the browser's clock.
function greeting(firstName: string | null, at = new Date()): string {
  const hour = at.getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return firstName ? `Good ${part}, ${firstName}` : `Good ${part}`;
}

// Tenantry's front page (spec 8.2): a greeting, the setup card for owners and admins, the numbers, and the
// latest projects.
export function HomeRoute() {
  const me = useMe();
  const api = useApi();
  const workspaces = useWorkspaces();
  const projects = useResource<{ projects: Project[] }>('/api/projects');
  const guides = me.can('members:invite') || me.can('tenant:settings');
  const members = useResource<{ members: unknown[]; invites: unknown[] }>('/api/members');
  const { branding } = useBranding(me.tenant.slug);
  const list = projects.data?.projects ?? [];
  const recent = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT);
  const firstName = me.user.displayName?.trim().split(/\s+/)[0] ?? null;

  const tiles = [
    ...(guides && members.data
      ? [
          <StatTile key="people" icon={UserMultiple} label="People" value={members.data.members.length} />,
          <StatTile key="invites" icon={Email} label="Open invites" value={members.data.invites.length} />,
        ]
      : []),
    ...(projects.data
      ? [<StatTile key="projects" icon={Folder} label="Projects" value={list.length} />]
      : []),
  ];

  return (
    <DashboardPage
      title={greeting(firstName)}
      description={`Here's what's happening in ${me.tenant.name}.`}
      tiles={[]}
      activity={
        <Stack gap={7}>
          <ApiErrorNotification error={projects.error ?? members.error} />
          {guides && projects.data && members.data && (
            <Checklist
              done={{
                project: list.length > 0,
                invite: members.data.members.length > 1 || members.data.invites.length > 0,
                brand: Boolean(branding?.primaryColor ?? branding?.logoUrl),
              }}
              inviteUrl={adminUrl(workspaces, '/people?invite=1')}
              brandingUrl={adminUrl(workspaces, '/branding')}
              onCreateProject={async (name) => {
                await api.post('/api/projects', { name });
                projects.reload();
              }}
            />
          )}
          {tiles.length > 0 && <div className="tenantry-home__stats">{tiles}</div>}
          <section aria-label="Recent projects">
            <Tile>
              <div className="tenantry-home__section-header">
                <h2 className="tenantry-home__heading">Recent projects</h2>
                <Link as={RouterLink} href="/projects" renderIcon={ArrowRight}>
                  All projects
                </Link>
              </div>
              {projects.data && recent.length === 0 && (
                <EmptyState
                  icon={FolderOpen}
                  title="Start your first project"
                  body="Projects keep your team's work in one place."
                  action={
                    me.can('projects:write') ? (
                      <Button as={RouterLink} href="/projects" kind="tertiary" size="sm">
                        Go to Projects
                      </Button>
                    ) : undefined
                  }
                />
              )}
              {recent.length > 0 && (
                <StructuredListWrapper aria-label="Recent projects">
                  <StructuredListBody>
                    {recent.map((p) => (
                      <StructuredListRow key={p.id}>
                        <StructuredListCell>
                          <span className="tenantry-home__project">
                            <Folder size={16} aria-hidden="true" />
                            {p.name}
                          </span>
                        </StructuredListCell>
                        <StructuredListCell>{new Date(p.createdAt).toLocaleDateString()}</StructuredListCell>
                      </StructuredListRow>
                    ))}
                  </StructuredListBody>
                </StructuredListWrapper>
              )}
            </Tile>
          </section>
        </Stack>
      }
    />
  );
}
