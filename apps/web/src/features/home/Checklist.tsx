import { Button, InlineLoading, Link, Stack, TextInput, Tile } from '@carbon/react';
import { CheckmarkFilled } from '@carbon/icons-react';
import { useMe } from '@tenantry/app-kit';
import { useState, type ReactNode } from 'react';

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

function Step({ label, done, children }: { label: string; done: boolean; children: ReactNode }) {
  return (
    <li className="tenantry-checklist__step" data-done={done ? 'true' : 'false'}>
      <Tile>
        <Stack gap={4}>
          {done ? (
            <p className="tenantry-checklist__done">
              <CheckmarkFilled aria-label="Done" className="tenantry-checklist__check" />
              {label}
            </p>
          ) : (
            children
          )}
        </Stack>
      </Tile>
    </li>
  );
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

// Three steps that show a new owner what Tenantry does; gone once all are done, or hidden.
export function Checklist({ done, inviteUrl, brandingUrl, onCreateProject }: ChecklistProps) {
  const me = useMe();
  const key = `tenantry.checklist.hidden.${me.user.id}.${me.tenant.slug}`;
  const [hidden, setHidden] = useState(() => readHidden(key));
  if (hidden || (done.project && done.invite && done.brand)) return null;
  return (
    <section aria-label="Get started" className="tenantry-checklist">
      <div className="tenantry-checklist__header">
        <h2 className="tenantry-checklist__title">Get started</h2>
        <Button
          kind="ghost"
          size="sm"
          onClick={() => {
            writeHidden(key);
            setHidden(true);
          }}
        >
          Hide
        </Button>
      </div>
      <ol className="tenantry-checklist__steps">
        <Step label="Create a project" done={done.project}>
          <CreateProject onCreate={onCreateProject} />
        </Step>
        <Step label="Invite a teammate" done={done.invite}>
          <p className="tenantry-checklist__label">Bring someone into the workspace.</p>
          {inviteUrl && <Link href={inviteUrl}>Invite a teammate</Link>}
        </Step>
        <Step label="Add your colour and logo" done={done.brand}>
          <p className="tenantry-checklist__label">Make the sign-in page and the apps look like yours.</p>
          {brandingUrl && <Link href={brandingUrl}>Add your colour and logo</Link>}
        </Step>
      </ol>
    </section>
  );
}
