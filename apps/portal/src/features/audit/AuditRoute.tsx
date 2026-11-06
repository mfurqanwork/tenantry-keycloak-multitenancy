import { RecentlyViewed } from '@carbon/icons-react';
import {
  Button,
  DataTable,
  DataTableSkeleton,
  InlineLoading,
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
} from '@carbon/react';
import { EmptyState, ListPage } from '@tenantry/ui';
import { useSearchParams } from 'react-router';
import { useEffect, useState } from 'react';
import { ApiErrorNotification, useApi, useMe, useResource } from '@tenantry/app-kit';

interface AuditEntry {
  id: string;
  action: string;
  target: string;
  targetLabel: string | null;
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
  // Search results open this page filtered (?q=); the box filters what is loaded.
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    setMore([]);
  }, [first.data]);

  const pages = first.data ? [first.data, ...more] : [];
  const all = pages.flatMap((p) => p.entries);
  const q = query.trim().toLowerCase();
  const entries = all.filter(
    (e) => !q || [e.action, e.actor.email, e.targetLabel, e.target].some((v) => v?.toLowerCase().includes(q)),
  );
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
      icon={RecentlyViewed}
      description="Every change to people, sign-in and settings, newest first."
      isEmpty={first.data !== undefined && all.length === 0}
      emptyState={
        <EmptyState
          icon={RecentlyViewed}
          title="Nothing has happened yet"
          body="Changes to people, sign-in and settings show up here as they happen."
        />
      }
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
              target: e.targetLabel ?? e.target,
            }))}
            headers={HEADERS}
          >
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <TableContainer>
                <TableToolbar aria-label="Audit log toolbar">
                  <TableToolbarContent>
                    <TableToolbarSearch
                      persistent
                      labelText="Search the audit log"
                      placeholder="Search by person, action or target"
                      defaultValue={query}
                      onChange={(_event, value) => {
                        // Carbon reports the starting value as onChange('', value) on load.
                        setQuery(value ?? '');
                      }}
                    />
                  </TableToolbarContent>
                </TableToolbar>
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
            {loading ? (
              <InlineLoading description="Loading more" />
            ) : (
              <Button kind="ghost" onClick={() => void loadMore(next)}>
                Load more
              </Button>
            )}
          </div>
        )}
      </Stack>
    </ListPage>
  );
}
