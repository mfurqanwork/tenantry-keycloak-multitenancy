import { Loading, useMe } from '@tenantry/app-kit';
import { Button, Input, Label, SetupCard } from '@tenantry/ui';
import { FolderPlus, Palette, Rocket, UserPlus } from 'lucide-react';
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
      <div className="flex flex-col gap-2">
        <p className="font-medium">Create a project</p>
        <Label htmlFor="checklist-project-name" className="text-muted-foreground">
          Project name
        </Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="checklist-project-name"
            className="max-w-xs"
            maxLength={120}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          {!busy && (
            <Button type="submit" variant="secondary" disabled={name.trim() === ''}>
              Create
            </Button>
          )}
        </div>
        {busy && <Loading description="Creating the project" />}
      </div>
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
          icon: FolderPlus,
          content: <CreateProject onCreate={onCreateProject} />,
        },
        {
          label: 'Invite a teammate',
          done: done.invite,
          icon: UserPlus,
          content: (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">Bring someone into the workspace.</p>
              {inviteUrl && (
                <a className="w-fit font-medium text-link hover:underline" href={inviteUrl}>
                  Invite a teammate
                </a>
              )}
            </div>
          ),
        },
        {
          label: 'Add your colour and logo',
          done: done.brand,
          icon: Palette,
          content: (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">Make the sign-in page and the apps look like yours.</p>
              {brandingUrl && (
                <a className="w-fit font-medium text-link hover:underline" href={brandingUrl}>
                  Add your colour and logo
                </a>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
