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
  Tile,
} from '@carbon/react';
import { ListPage } from '@tenantry/ui';
import { useEffect, useState } from 'react';
import { useApi } from '../../lib/api.js';
import { ApiErrorNotification } from '../../lib/ApiErrorNotification.js';
import { useMe } from '../../lib/me.js';
import { useResource } from '../../lib/useResource.js';

interface AuditEntry {
  id: string;
  action: string;
  target: string;
  createdAt: string;
  actor: { id: string | null; email: string | null };
}
interface AuditPage {
  entries: AuditEntry[];
  nextBefore: string | null;
}

const HEADERS = [
  { key: 'createdAt', header: 'Time' },
  { key: 'actor', header: 'Actor' },
  { key: 'action', header: 'Action' },
  { key: 'target', header: 'Target' },
];

export function AuditRoute() {
  const me = useMe();
  const api = useApi();
  const first = useResource<AuditPage>('/api/audit');
  const [more, setMore] = useState<AuditPage[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMore([]);
  }, [first.data]);

  const pages = first.data ? [first.data, ...more] : [];
  const entries = pages.flatMap((p) => p.entries);
  const next = pages.at(-1)?.nextBefore ?? null;

  async function loadMore(before: string) {
    setLoading(true);
    setError(null);
    try {
      const page = await api.get<AuditPage>(`/api/audit?before=${encodeURIComponent(before)}`);
      setMore((m) => [...m, page]);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ListPage
      breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
      title="Audit log"
      isEmpty={first.data !== undefined && entries.length === 0}
      emptyState={<Tile>Nothing has happened in this workspace yet.</Tile>}
    >
      <Stack gap={6}>
        <ApiErrorNotification error={first.error ?? error} />
        {!first.data && !first.error && <DataTableSkeleton headers={HEADERS} rowCount={5} />}
        {first.data && (
          <DataTable
            rows={entries.map((e) => ({
              id: e.id,
              createdAt: new Date(e.createdAt).toLocaleString(),
              actor: e.actor.email ?? 'System',
              action: e.action,
              target: e.target,
            }))}
            headers={HEADERS}
          >
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <TableContainer>
                <Table {...getTableProps()} aria-label="Audit log">
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
        {next && (
          <div>
            <Button kind="ghost" disabled={loading} onClick={() => void loadMore(next)}>
              Load more
            </Button>
          </div>
        )}
      </Stack>
    </ListPage>
  );
}
