import {
  Button,
  DataTable,
  DataTableSkeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  TextInput,
} from '@carbon/react';
import { Add, Folder, FolderOpen } from '@carbon/icons-react';
import { EmptyState, ListPage } from '@tenantry/ui';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ApiErrorNotification, FormDialog, useApi, useMe, useResource } from '@tenantry/app-kit';

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

const HEADERS = [
  { key: 'name', header: 'Name' },
  { key: 'createdAt', header: 'Created' },
];

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
      <TextInput
        id="project-name"
        labelText="Name"
        maxLength={120}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
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
        icon={Folder}
        description="Your team's work, kept to this workspace."
        primaryAction={
          me.can('projects:write') ? (
            <Button
              renderIcon={Add}
              onClick={() => {
                setCreating(true);
              }}
            >
              Create project
            </Button>
          ) : undefined
        }
        isEmpty={list.data !== undefined && projects.length === 0}
        emptyState={
          <EmptyState
            icon={FolderOpen}
            title="Start your first project"
            body="Projects keep your team's work in one place, and only this workspace sees them."
          />
        }
      >
        <Stack gap={6}>
          <ApiErrorNotification error={list.error} />
          {!list.data && !list.error && <DataTableSkeleton headers={HEADERS} rowCount={3} />}
          {list.data && (
            <DataTable
              rows={shown.map((p) => ({
                id: p.id,
                name: p.name,
                createdAt: new Date(p.createdAt).toLocaleDateString(),
              }))}
              headers={HEADERS}
            >
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <TableContainer>
                  <TableToolbar aria-label="Projects toolbar">
                    <TableToolbarContent>
                      <TableToolbarSearch
                        persistent
                        labelText="Search projects"
                        placeholder="Search projects"
                        defaultValue={query}
                        onChange={(_event, value) => {
                          // Carbon reports the starting value as onChange('', value) on load.
                          setQuery(value ?? '');
                        }}
                      />
                    </TableToolbarContent>
                  </TableToolbar>
                  <Table {...getTableProps()} aria-label="Projects">
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader {...getHeaderProps({ header })} key={header.key}>
                            {header.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow {...getRowProps({ row })} key={row.id}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>{cell.value as string}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          )}
        </Stack>
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
