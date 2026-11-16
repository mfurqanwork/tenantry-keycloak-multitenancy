import { ApiErrorNotification, FormDialog, useApi, useMe, useResource } from '@tenantry/app-kit';
import {
  Button,
  EmptyState,
  Input,
  Label,
  ListPage,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tenantry/ui';
import { FolderKanban, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

function CreateProjectDialog({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const api = useApi();
  const [name, setName] = useState('');
  return (
    <FormDialog
      heading="Create project"
      submitLabel="Create"
      canSubmit={name.trim() !== ''}
      onSubmit={async () => {
        await api.post('/api/projects', { name: name.trim() });
        onDone();
      }}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="project-name">Name</Label>
        <Input
          id="project-name"
          maxLength={120}
          autoComplete="off"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </div>
    </FormDialog>
  );
}

// The row-level security example: each workspace sees only its own projects.
export function ProjectsRoute() {
  const me = useMe();
  const list = useResource<{ projects: Project[] }>('/api/projects');
  const [creating, setCreating] = useState(false);
  // Search results open this page filtered (?q=); the box filters what is loaded.
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const projects = list.data?.projects ?? [];
  const shown = projects.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  // The dialog sits beside the page: ListPage swaps its children for the empty state.
  return (
    <>
      <ListPage
        breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
        title="Projects"
        icon={FolderKanban}
        description="Your team's work, kept to this workspace."
        primaryAction={
          me.can('projects:write') ? (
            <Button
              onClick={() => {
                setCreating(true);
              }}
            >
              <Plus aria-hidden="true" />
              New project
            </Button>
          ) : undefined
        }
        isEmpty={list.data !== undefined && projects.length === 0}
        emptyState={
          <EmptyState
            icon={FolderKanban}
            title="Start your first project"
            body="Projects keep your team's work in one place, and only this workspace sees them."
          />
        }
      >
        <ApiErrorNotification error={list.error} />
        {!list.data && !list.error && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {list.data && (
          <div className="flex flex-col gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Label htmlFor="project-search" className="sr-only">
                Search projects
              </Label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="project-search"
                type="search"
                placeholder="Search projects"
                className="pl-8"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
              />
            </div>
            <Table aria-label="Projects">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <FolderKanban aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        {p.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {shown.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{`No projects match "${query.trim()}".`}</p>
            )}
          </div>
        )}
      </ListPage>
      {creating && (
        <CreateProjectDialog
          onDone={list.reload}
          onClose={() => {
            setCreating(false);
          }}
        />
      )}
    </>
  );
}
