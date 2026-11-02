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
  TextInput,
  Tile,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { ListPage } from '@tenantry/ui';
import { useState } from 'react';
import { useApi } from '../../lib/api.js';
import { ApiErrorNotification } from '../../lib/ApiErrorNotification.js';
import { FormDialog } from '../../lib/FormDialog.js';
import { useMe } from '../../lib/me.js';
import { useResource } from '../../lib/useResource.js';

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
  const projects = list.data?.projects ?? [];

  // The dialog sits beside the page: ListPage swaps its children for the empty state.
  return (
    <>
      <ListPage
        breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
        title="Projects"
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
        emptyState={<Tile>No projects yet. Create one to get started.</Tile>}
      >
        <Stack gap={6}>
          <ApiErrorNotification error={list.error} />
          {!list.data && !list.error && <DataTableSkeleton headers={HEADERS} rowCount={3} />}
          {list.data && (
            <DataTable
              rows={projects.map((p) => ({
                id: p.id,
                name: p.name,
                createdAt: new Date(p.createdAt).toLocaleDateString(),
              }))}
              headers={HEADERS}
            >
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <TableContainer>
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
