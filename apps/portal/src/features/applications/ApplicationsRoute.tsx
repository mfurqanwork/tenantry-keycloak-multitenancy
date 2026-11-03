import {
  Button,
  DataTable,
  DataTableSkeleton,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { ApiErrorNotification, RouterLink, useMe, useResource } from '@tenantry/app-kit';
import { ListPage } from '@tenantry/ui';
import { TYPE_LABELS, type AppView } from './api.js';

const HEADERS = [
  { key: 'name', header: 'Name' },
  { key: 'type', header: 'Type' },
  { key: 'clientId', header: 'Client ID' },
];

// Enterprise workspaces only (ADR-0011): the apps connected to the workspace's own sign-in.
export function ApplicationsRoute() {
  const me = useMe();
  if (me.tenant.tier !== 'enterprise') {
    return (
      <ListPage breadcrumbs={[{ label: me.tenant.name, href: '/' }]} title="Applications">
        <Tile>Applications are available on Enterprise workspaces.</Tile>
      </ListPage>
    );
  }
  return <EnterpriseApplications />;
}

function EnterpriseApplications() {
  const me = useMe();
  const list = useResource<{ apps: AppView[] }>('/api/apps');
  const apps = list.data?.apps ?? [];
  const registers = me.can('apps:register');
  return (
    <ListPage
      breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
      title="Applications"
      primaryAction={
        registers ? (
          <Button as={RouterLink} href="/applications/new" renderIcon={Add}>
            Register an app
          </Button>
        ) : undefined
      }
      isEmpty={list.data !== undefined && apps.length === 0}
      emptyState={
        <Tile>{registers ? 'No apps yet. Register one to connect it to your sign-in.' : 'No apps yet.'}</Tile>
      }
    >
      <Stack gap={6}>
        <ApiErrorNotification error={list.error} />
        {!list.data && !list.error && <DataTableSkeleton headers={HEADERS} rowCount={3} />}
        {list.data && (
          <DataTable
            rows={apps.map((a) => ({
              id: a.id,
              name: a.name,
              type: TYPE_LABELS[a.type],
              clientId: a.clientId,
            }))}
            headers={HEADERS}
          >
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <TableContainer>
                <Table {...getTableProps()} aria-label="Applications">
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
                          <TableCell key={cell.id}>
                            {cell.info.header === 'name' ? (
                              <Link as={RouterLink} href={`/applications/${row.id}`}>
                                {cell.value as string}
                              </Link>
                            ) : (
                              (cell.value as string)
                            )}
                          </TableCell>
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
  );
}
