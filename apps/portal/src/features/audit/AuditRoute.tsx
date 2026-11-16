import { ApiErrorNotification, Loading, useApi, useMe, useResource } from '@tenantry/app-kit';
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
import {
  Activity,
  AppWindow,
  Building2,
  FolderKanban,
  History,
  Palette,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

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

// An icon per event family, from the action's prefix (`member.invited` is a member event).
const FAMILIES: Record<string, { family: string; icon: LucideIcon }> = {
  member: { family: 'member', icon: User },
  invite: { family: 'member', icon: User },
  console: { family: 'member', icon: User },
  app: { family: 'app', icon: AppWindow },
  tenant: { family: 'tenant', icon: Building2 },
  branding: { family: 'tenant', icon: Palette },
  project: { family: 'tenant', icon: FolderKanban },
  security: { family: 'security', icon: ShieldCheck },
  idp: { family: 'security', icon: ShieldCheck },
  scim: { family: 'scim', icon: RefreshCw },
};
const OTHER = { family: 'other', icon: Activity };

function EventIcon({ action }: { action: string }) {
  const { family, icon: Icon } = FAMILIES[action.split('.')[0] ?? ''] ?? OTHER;
  return <Icon aria-hidden="true" data-family={family} className="size-4 shrink-0 text-muted-foreground" />;
}

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
      icon={History}
      description="Every change to people, sign-in and settings, newest first."
      isEmpty={first.data !== undefined && all.length === 0}
      emptyState={
        <EmptyState
          icon={History}
          title="Nothing has happened yet"
          body="Changes to people, sign-in and settings show up here as they happen."
        />
      }
    >
      <ApiErrorNotification error={first.error ?? error} />
      {!first.data && !first.error && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-60 w-full" />
        </div>
      )}
      {first.data && (
        <div className="flex flex-col gap-3">
          <div className="relative w-full sm:max-w-sm">
            <Label htmlFor="audit-search" className="sr-only">
              Search the audit log
            </Label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="audit-search"
              type="search"
              placeholder="Search by person, action or target"
              className="pl-8"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
          </div>
          <Table aria-label="Audit log">
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                    {new Date(e.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="py-2">{e.actor.email ?? 'System'}</TableCell>
                  <TableCell className="py-2">
                    <span className="flex items-center gap-2">
                      <EventIcon action={e.action} />
                      <span className="font-mono text-xs">{e.action}</span>
                    </span>
                  </TableCell>
                  <TableCell className="py-2">{e.targetLabel ?? e.target}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {entries.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{`Nothing matches "${query.trim()}".`}</p>
          )}
        </div>
      )}
      {next && (
        <div>
          {loading ? (
            <Loading description="Loading more" />
          ) : (
            <Button variant="outline" onClick={() => void loadMore(next)}>
              Load more
            </Button>
          )}
        </div>
      )}
    </ListPage>
  );
}
