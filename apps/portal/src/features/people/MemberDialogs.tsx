import { Select, SelectItem, TextInput } from '@carbon/react';
import type { Role } from '@tenantry/auth';
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
    <Select
      id="member-role"
      labelText="Role"
      value={value}
      onChange={(event) => {
        onChange(event.target.value as Role);
      }}
    >
      {roles.map((role) => (
        <SelectItem key={role} value={role} text={ROLE_LABELS[role]} />
      ))}
    </Select>
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
      <TextInput
        id="invite-email"
        type="email"
        labelText="Email"
        helperText="They get an email with a link to join."
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
      />
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
      <p>{member.email}</p>
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
      <p>
        Remove {member.email ?? 'this person'} from {tenantName}? They lose access at once.
      </p>
    </FormDialog>
  );
}
