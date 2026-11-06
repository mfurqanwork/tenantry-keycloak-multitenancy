import { Button, InlineLoading, Link, Stack, TextInput } from '@carbon/react';
import { Rocket } from '@carbon/icons-react';
import { SetupCard } from '@tenantry/ui';
import { useMe } from '@tenantry/app-kit';
import { useState } from 'react';

export interface ChecklistProps {
  done: { project: boolean; invite: boolean; brand: boolean };
  // Admin addresses (Tenantry and Admin are two apps, ADR-0027); null until the workspaces load.
  inviteUrl: string | null;
  brandingUrl: string | null;
  onCreateProject: (name: string) => Promise<void>;
}

// Remembered in this browser only; storage may be blocked, so every access is guarded (spec §2.3).
function readHidden(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function writeHidden(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Hidden for this visit only.
  }
}

function CreateProject({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() === '') return;
        setBusy(true);
        void onCreate(name.trim()).finally(() => {
          setBusy(false);
        });
      }}
    >
      <Stack gap={4}>
        <p className="tenantry-checklist__label">Create a project</p>
        <TextInput
          id="checklist-project-name"
          labelText="Project name"
          maxLength={120}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        {busy ? (
          <InlineLoading description="Creating the project" />
        ) : (
          <Button type="submit" kind="tertiary" size="sm" disabled={name.trim() === ''}>
            Create
          </Button>
        )}
      </Stack>
    </form>
  );
}

// Three steps that show a new owner what Tenantry does, on the shared setup card; gone once all are done,
// or hidden.
export function Checklist({ done, inviteUrl, brandingUrl, onCreateProject }: ChecklistProps) {
  const me = useMe();
  const key = `tenantry.checklist.hidden.${me.user.id}.${me.tenant.slug}`;
  const [hidden, setHidden] = useState(() => readHidden(key));
  if (hidden) return null;
  return (
    <SetupCard
      title="Finish setting up"
      icon={Rocket}
      onHide={() => {
        writeHidden(key);
        setHidden(true);
      }}
      steps={[
        {
          label: 'Create a project',
          done: done.project,
          content: <CreateProject onCreate={onCreateProject} />,
        },
        {
          label: 'Invite a teammate',
          done: done.invite,
          content: (
            <Stack gap={3}>
              <p className="tenantry-checklist__label">Invite a teammate</p>
              <p className="tenantry-checklist__hint">Bring someone into the workspace.</p>
              {inviteUrl && <Link href={inviteUrl}>Invite a teammate</Link>}
            </Stack>
          ),
        },
        {
          label: 'Add your colour and logo',
          done: done.brand,
          content: (
            <Stack gap={3}>
              <p className="tenantry-checklist__label">Add your colour and logo</p>
              <p className="tenantry-checklist__hint">Make the sign-in page and the apps look like yours.</p>
              {brandingUrl && <Link href={brandingUrl}>Add your colour and logo</Link>}
            </Stack>
          ),
        },
      ]}
    />
  );
}
