import type { Role } from '@tenantry/auth';
import {
  ApiErrorNotification,
  assignableRoles,
  ROLE_LABELS,
  useApi,
  useMe,
  useResource,
} from '@tenantry/app-kit';
import {
  Avatar,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  TechLogo,
  type BadgeTone,
} from '@tenantry/ui';
import { Ellipsis, Search, Trash2, UserCog, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ChangeRoleDialog, InviteDialog, RemoveMemberDialog } from './MemberDialogs.js';

interface MemberRow {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: Role | null;
  // Enterprise workspaces: may open the realm's Keycloak console (ADR-0026).
  console?: boolean;
}
interface InviteRow {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

type Dialog = { kind: 'invite' } | { kind: 'role' | 'remove'; member: MemberRow } | null;

const ROLE_TONES: Record<Role, BadgeTone> = { owner: 'primary', admin: 'primary', member: 'neutral' };

export function PeopleRoute() {
  const me = useMe();
  const api = useApi();
  const list = useResource<{ members: MemberRow[]; invites: InviteRow[] }>('/api/members');
  // /people?invite=1 (Tenantry's getting-started checklist) opens the invite dialog straight away.
  const [searchParams] = useSearchParams();
  // Search results open this page filtered (?q=); the box filters what is loaded.
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [dialog, setDialog] = useState<Dialog>(() =>
    searchParams.get('invite') === '1' && me.can('members:invite') ? { kind: 'invite' } : null,
  );
  const [actionError, setActionError] = useState<unknown>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [consoleBusy, setConsoleBusy] = useState<string | null>(null);
  const roles = assignableRoles(me.role);
  const manages = me.can('members:change-role') || me.can('members:remove');
  // Owners of an enterprise workspace let owners and admins into the realm's console.
  const grantsConsole = me.tenant.tier === 'enterprise' && me.can('tenant:settings');
  const mayHaveConsole = (m: MemberRow) => m.role === 'owner' || m.role === 'admin';
  const setConsole = (member: MemberRow, on: boolean) => {
    setActionError(null);
    setConsoleBusy(member.userId);
    const path = `/api/members/${encodeURIComponent(member.userId)}/console`;
    void (on ? api.post(path, {}) : api.del(path)).then(list.reload, setActionError).finally(() => {
      setConsoleBusy(null);
    });
  };
  const revoke = (invite: InviteRow) => {
    setActionError(null);
    setRevoking(invite.id);
    void api
      .del(`/api/members/invites/${invite.id}`)
      .then(list.reload, setActionError)
      .finally(() => {
        setRevoking(null);
      });
  };
  const close = () => {
    setDialog(null);
  };

  const members = list.data?.members ?? [];
  const q = query.trim().toLowerCase();
  const shownMembers = members.filter(
    (m) => !q || [m.displayName, m.email].some((v) => v?.toLowerCase().includes(q)),
  );
  const invites = list.data?.invites ?? [];
  const actions = manages || grantsConsole;

  // Dialogs sit beside the page, never inside the part ListPage may swap for its empty state.
  return (
    <>
      <ListPage
        breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
        title="People"
        icon={Users}
        description="Who is in this workspace, their roles, and open invites."
        primaryAction={
          me.can('members:invite') ? (
            <Button
              onClick={() => {
                setDialog({ kind: 'invite' });
              }}
            >
              <UserPlus aria-hidden="true" />
              Invite member
            </Button>
          ) : undefined
        }
        isEmpty={list.data !== undefined && members.length === 0}
        emptyState={
          <EmptyState icon={Users} title="Invite your team" body="People you invite get an email with a link to join." />
        }
      >
        <ApiErrorNotification error={list.error ?? actionError} />
        {!list.data && !list.error && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {list.data && (
          <div className="flex flex-col gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Label htmlFor="people-search" className="sr-only">
                Search people
              </Label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="people-search"
                type="search"
                placeholder="Search by name or email"
                className="pl-8"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
              />
            </div>
            <Table aria-label="Members">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  {actions && (
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownMembers.map((member) => {
                  const canManage = manages && member.userId !== me.user.id;
                  const consoleItem = grantsConsole && mayHaveConsole(member);
                  return (
                    <TableRow key={member.userId}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <Avatar name={member.displayName ?? member.email ?? ''} size="sm" />
                          {member.displayName ?? ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{member.email ?? ''}</TableCell>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={member.role ? ROLE_TONES[member.role] : 'neutral'}>
                            {member.role ? ROLE_LABELS[member.role] : 'No role yet'}
                          </Badge>
                          {member.console && (
                            <Badge tone="success">
                              <TechLogo name="keycloak" size={12} decorative />
                              Console access
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      {actions && (
                        <TableCell className="text-right">
                          {(canManage || consoleItem) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Actions for ${member.email ?? 'member'}`}
                                >
                                  <Ellipsis aria-hidden="true" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canManage && me.can('members:change-role') && (
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setDialog({ kind: 'role', member });
                                    }}
                                  >
                                    <UserCog aria-hidden="true" />
                                    Change role
                                  </DropdownMenuItem>
                                )}
                                {consoleItem && (
                                  <DropdownMenuItem
                                    disabled={consoleBusy === member.userId}
                                    onSelect={() => {
                                      setConsole(member, !member.console);
                                    }}
                                  >
                                    <TechLogo name="keycloak" decorative />
                                    {member.console ? 'Take console access away' : 'Give console access'}
                                  </DropdownMenuItem>
                                )}
                                {canManage && me.can('members:remove') && (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => {
                                      setDialog({ kind: 'remove', member });
                                    }}
                                  >
                                    <Trash2 aria-hidden="true" />
                                    Remove
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {shownMembers.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{`No one matches "${query.trim()}".`}</p>
            )}
          </div>
        )}
        {invites.length > 0 && (
          <section aria-labelledby="pending-invites" className="flex flex-col gap-3">
            <h2 id="pending-invites" className="text-lg font-semibold">
              Pending invites
            </h2>
            <Table aria-label="Pending invites">
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited</TableHead>
                  {me.can('members:invite') && (
                    <TableHead className="w-24">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                      <Badge tone={ROLE_TONES[invite.role]}>{ROLE_LABELS[invite.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {new Date(invite.createdAt).toLocaleDateString()}
                    </TableCell>
                    {me.can('members:invite') && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={revoking === invite.id}
                          onClick={() => {
                            revoke(invite);
                          }}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}
      </ListPage>
      {dialog?.kind === 'invite' && <InviteDialog roles={roles} onDone={list.reload} onClose={close} />}
      {dialog?.kind === 'role' && (
        <ChangeRoleDialog member={dialog.member} roles={roles} onDone={list.reload} onClose={close} />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveMemberDialog
          member={dialog.member}
          tenantName={me.tenant.name}
          onDone={list.reload}
          onClose={close}
        />
      )}
    </>
  );
}
