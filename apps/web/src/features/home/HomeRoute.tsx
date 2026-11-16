import { ArrowRight, FolderKanban, FolderOpen, Mail, Users } from 'lucide-react';
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
import { Button, DashboardPage, EmptyState, StatTile, TileGrid } from '@tenantry/ui';
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
          <StatTile key="people" icon={Users} label="People" value={members.data.members.length} />,
          <StatTile key="invites" icon={Mail} label="Open invites" value={members.data.invites.length} />,
        ]
      : []),
    ...(projects.data
      ? [<StatTile key="projects" icon={FolderKanban} label="Projects" value={list.length} />]
      : []),
  ];

  return (
    <DashboardPage
      title={greeting(firstName)}
      description={`Here's what's happening in ${me.tenant.name}.`}
      tiles={[]}
      activity={
        <div className="flex flex-col gap-6">
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
          {tiles.length > 0 && <TileGrid>{tiles}</TileGrid>}
          <section aria-labelledby="recent-projects" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 id="recent-projects" className="text-base font-semibold">
                Recent projects
              </h2>
              <RouterLink href="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
                All projects
                <ArrowRight aria-hidden="true" className="size-4" />
              </RouterLink>
            </div>
            {projects.data && recent.length === 0 && (
              <EmptyState
                icon={FolderOpen}
                title="Start your first project"
                body="Projects keep your team's work in one place."
                action={
                  me.can('projects:write') ? (
                    <Button asChild variant="secondary" size="sm">
                      <RouterLink href="/projects">Go to Projects</RouterLink>
                    </Button>
                  ) : undefined
                }
              />
            )}
            {recent.length > 0 && (
              <ul aria-labelledby="recent-projects" className="flex flex-col divide-y divide-border">
                {recent.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <FolderKanban aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      }
    />
  );
}
