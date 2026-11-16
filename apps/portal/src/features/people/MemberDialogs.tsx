import type { Role } from '@tenantry/auth';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tenantry/ui';
import { useState } from 'react';
import { FormDialog, ROLE_LABELS, useApi } from '@tenantry/app-kit';

function RoleSelect({
  roles,
  value,
  onChange,
}: {
  roles: Role[];
  value: Role;
  onChange: (role: Role) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="member-role">Role</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          onChange(next as Role);
        }}
      >
        <SelectTrigger id="member-role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {ROLE_LABELS[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function InviteDialog({
  roles,
  onDone,
  onClose,
}: {
  roles: Role[];
  onDone: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  return (
    <FormDialog
      heading="Invite member"
      submitLabel="Send invite"
      canSubmit={email.trim() !== ''}
      onSubmit={async () => {
        await api.post('/api/members/invites', { email: email.trim(), role });
        onDone();
      }}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          autoComplete="off"
          aria-describedby="invite-email-help"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
        <p id="invite-email-help" className="text-sm text-muted-foreground">
          They get an email with a link to join.
        </p>
      </div>
      <RoleSelect roles={roles} value={role} onChange={setRole} />
    </FormDialog>
  );
}

export function ChangeRoleDialog({
  member,
  roles,
  onDone,
  onClose,
}: {
  member: { userId: string; email: string | null; role: Role | null };
  roles: Role[];
  onDone: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  const [role, setRole] = useState<Role>(member.role ?? 'member');
  return (
    <FormDialog
      heading="Change role"
      submitLabel="Save"
      canSubmit={role !== member.role}
      onSubmit={async () => {
        await api.patch(`/api/members/${encodeURIComponent(member.userId)}`, { role });
        onDone();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">{member.email}</p>
      <RoleSelect roles={roles} value={role} onChange={setRole} />
    </FormDialog>
  );
}

export function RemoveMemberDialog({
  member,
  tenantName,
  onDone,
  onClose,
}: {
  member: { userId: string; email: string | null };
  tenantName: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  return (
    <FormDialog
      heading="Remove member"
      submitLabel="Remove"
      danger
      canSubmit
      onSubmit={async () => {
        await api.del(`/api/members/${encodeURIComponent(member.userId)}`);
        onDone();
      }}
      onClose={onClose}
    >
      <p className="text-sm">
        Remove {member.email ?? 'this person'} from {tenantName}? They lose access at once.
      </p>
    </FormDialog>
  );
}
