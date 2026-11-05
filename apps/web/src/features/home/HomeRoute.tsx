import {
  Link,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tile,
} from '@carbon/react';
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
import { DashboardPage } from '@tenantry/ui';
import { Checklist } from './Checklist.js';

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

const RECENT = 5;

// Tenantry's front page: the getting-started checklist for owners and admins, then the latest projects.
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

  const checklist =
    guides && projects.data && members.data ? (
      <Checklist
        key="checklist"
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
    ) : null;

  return (
    <DashboardPage
      title="Home"
      tiles={[]}
      activity={
        <Stack gap={6}>
          <ApiErrorNotification error={projects.error ?? members.error} />
          {checklist}
          <section aria-label="Recent projects">
            <Stack gap={4}>
              <h2 className="tenantry-home__heading">Recent projects</h2>
              {projects.data && recent.length === 0 && <Tile>No projects yet.</Tile>}
              {recent.length > 0 && (
                <StructuredListWrapper aria-label="Recent projects">
                  <StructuredListBody>
                    {recent.map((p) => (
                      <StructuredListRow key={p.id}>
                        <StructuredListCell>{p.name}</StructuredListCell>
                        <StructuredListCell>{new Date(p.createdAt).toLocaleDateString()}</StructuredListCell>
                      </StructuredListRow>
                    ))}
                  </StructuredListBody>
                </StructuredListWrapper>
              )}
              <Link as={RouterLink} href="/projects">
                All projects
              </Link>
            </Stack>
          </section>
        </Stack>
      }
    />
  );
}
