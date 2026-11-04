import {
  Button,
  DataTable,
  DataTableSkeleton,
  OverflowMenu,
  OverflowMenuItem,
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
import type { Role } from '@tenantry/auth';
import { ListPage } from '@tenantry/ui';
import { useState } from 'react';
import {
  ApiErrorNotification,
  assignableRoles,
  ROLE_LABELS,
  useApi,
  useMe,
  useResource,
} from '@tenantry/app-kit';
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

const MEMBER_HEADERS = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Role' },
];
const INVITE_HEADERS = [
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Role' },
  { key: 'createdAt', header: 'Invited' },
];

export function MembersRoute() {
  const me = useMe();
  const api = useApi();
  const list = useResource<{ members: MemberRow[]; invites: InviteRow[] }>('/api/members');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [consoleBusy, setConsoleBusy] = useState<string | null>(null);
  const roles = assignableRoles(me.role);
  const manages = me.can('members:change-role') || me.can('members:remove');
  // Owners of an enterprise workspace let owners and admins into the realm's console.
  const grantsConsole = me.tenant.tier === 'enterprise' && me.can('tenant:settings');
  const mayHaveConsole = (m: MemberRow | undefined) => m?.role === 'owner' || m?.role === 'admin';
  const setConsole = (member: MemberRow, on: boolean) => {
    setActionError(null);
    setConsoleBusy(member.userId);
    const path = `/api/members/${encodeURIComponent(member.userId)}/console`;
    void (on ? api.post(path, {}) : api.del(path)).then(list.reload, setActionError).finally(() => {
      setConsoleBusy(null);
    });
  };
  const close = () => {
    setDialog(null);
  };

  const members = list.data?.members ?? [];
  const invites = list.data?.invites ?? [];

  // Dialogs sit beside the page, never inside the part ListPage may swap for its empty state.
  return (
    <>
      <ListPage
        breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
        title="Members"
        primaryAction={
          me.can('members:invite') ? (
            <Button
              renderIcon={Add}
              onClick={() => {
                setDialog({ kind: 'invite' });
              }}
            >
              Invite member
            </Button>
          ) : undefined
        }
        isEmpty={list.data !== undefined && members.length === 0}
        emptyState={<Tile>No members yet. Invite someone to get started.</Tile>}
      >
        <Stack gap={6}>
          <ApiErrorNotification error={list.error ?? actionError} />
          {!list.data && !list.error && <DataTableSkeleton headers={MEMBER_HEADERS} rowCount={3} />}
          {list.data && (
            <DataTable
              rows={members.map((m) => ({
                id: m.userId,
                name: m.displayName ?? '',
                email: m.email ?? '',
                role: `${m.role ? ROLE_LABELS[m.role] : 'No role yet'}${m.console ? ' · Console access' : ''}`,
              }))}
              headers={MEMBER_HEADERS}
            >
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <TableContainer>
                  <Table {...getTableProps()} aria-label="Members">
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader {...getHeaderProps({ header })} key={header.key}>
                            {header.header}
                          </TableHeader>
                        ))}
                        {(manages || grantsConsole) && <TableHeader aria-label="Actions" />}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => {
                        const member = members.find((m) => m.userId === row.id);
                        const canManage = manages && member && member.userId !== me.user.id;
                        const consoleItem = grantsConsole && member && mayHaveConsole(member);
                        return (
                          <TableRow {...getRowProps({ row })} key={row.id}>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>{cell.value as string}</TableCell>
                            ))}
                            {(manages || grantsConsole) && (
                              <TableCell className="cds--table-column-menu">
                                {member && (canManage || consoleItem) && (
                                  <OverflowMenu
                                    aria-label={`Actions for ${member.email ?? 'member'}`}
                                    iconDescription={`Actions for ${member.email ?? 'member'}`}
                                    flipped
                                    size="sm"
                                  >
                                    {consoleItem && (
                                      <OverflowMenuItem
                                        itemText={
                                          member.console ? 'Take console access away' : 'Give console access'
                                        }
                                        disabled={consoleBusy === member.userId}
                                        onClick={() => {
                                          setConsole(member, !member.console);
                                        }}
                                      />
                                    )}
                                    {canManage && me.can('members:change-role') && (
                                      <OverflowMenuItem
                                        itemText="Change role"
                                        onClick={() => {
                                          setDialog({ kind: 'role', member });
                                        }}
                                      />
                                    )}
                                    {canManage && me.can('members:remove') && (
                                      <OverflowMenuItem
                                        itemText="Remove"
                                        isDelete
                                        onClick={() => {
                                          setDialog({ kind: 'remove', member });
                                        }}
                                      />
                                    )}
                                  </OverflowMenu>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          )}
          {invites.length > 0 && (
            <section aria-labelledby="pending-invites">
              <h2 id="pending-invites" className="tenantry-section__title">
                Pending invites
              </h2>
              <DataTable
                rows={invites.map((i) => ({
                  id: i.id,
                  email: i.email,
                  role: ROLE_LABELS[i.role],
                  createdAt: new Date(i.createdAt).toLocaleDateString(),
                }))}
                headers={INVITE_HEADERS}
              >
                {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                  <TableContainer>
                    <Table {...getTableProps()} aria-label="Pending invites">
                      <TableHead>
                        <TableRow>
                          {headers.map((header) => (
                            <TableHeader {...getHeaderProps({ header })} key={header.key}>
                              {header.header}
                            </TableHeader>
                          ))}
                          {me.can('members:invite') && <TableHeader aria-label="Actions" />}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow {...getRowProps({ row })} key={row.id}>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>{cell.value as string}</TableCell>
                            ))}
                            {me.can('members:invite') && (
                              <TableCell>
                                <Button
                                  kind="ghost"
                                  size="sm"
                                  disabled={revoking === row.id}
                                  onClick={() => {
                                    setActionError(null);
                                    setRevoking(row.id);
                                    api
                                      .del(`/api/members/invites/${row.id}`)
                                      .then(list.reload, setActionError)
                                      .finally(() => {
                                        setRevoking(null);
                                      });
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
                  </TableContainer>
                )}
              </DataTable>
            </section>
          )}
        </Stack>
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
