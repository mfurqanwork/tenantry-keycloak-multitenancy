import {
  Button,
  DashboardPage,
  DetailPage,
  EmptyState,
  Input,
  Label,
  ListPage,
  SettingsPage,
  StatTile,
  WizardPage,
} from '@tenantry/ui';
import { AppWindow, Plus, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';

const noop = () => undefined;

function Sample({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 px-4 py-6 sm:px-6 lg:px-8" aria-labelledby={`sample-${name}`}>
      <h2 id={`sample-${name}`} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {name}
      </h2>
      <div className="rounded-xl border border-dashed border-border">{children}</div>
    </section>
  );
}

// Every page pattern once, with sample content, for visual checks in both themes.
export function PatternsRoute() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('Acme');
  return (
    <>
      <Sample name="List page">
        <ListPage
          breadcrumbs={[{ label: 'Acme', href: '/' }]}
          title="Members"
          icon={Users}
          primaryAction={
            <Button>
              <Plus aria-hidden="true" />
              Invite
            </Button>
          }
          isEmpty
          emptyState={<EmptyState icon={Users} title="No members yet" body="Invite someone to get started." />}
        >
          {null}
        </ListPage>
      </Sample>
      <Sample name="Detail page">
        <DetailPage
          breadcrumbs={[{ label: 'Members', href: '/' }]}
          title="Ada Lovelace"
          summary={<p className="text-sm text-muted-foreground">Role: Admin</p>}
          tabs={[
            { label: 'Overview', content: 'Overview content' },
            { label: 'Activity', content: 'Activity content' },
          ]}
        />
      </Sample>
      <Sample name="Settings page">
        <SettingsPage
          title="Workspace settings"
          dirty={name !== 'Acme'}
          saving={false}
          onSave={noop}
          onDiscard={() => {
            setName('Acme');
          }}
        >
          <div className="flex max-w-sm flex-col gap-2">
            <Label htmlFor="tenant-name">Workspace name</Label>
            <Input
              id="tenant-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>
        </SettingsPage>
      </Sample>
      <Sample name="Dashboard">
        <DashboardPage
          title="Overview"
          tiles={[
            <StatTile key="a" icon={Users} label="Members" value={12} />,
            <StatTile key="b" icon={AppWindow} label="Apps" value={3} />,
          ]}
        />
      </Sample>
      <Sample name="Wizard">
        <WizardPage
          title="Create a workspace"
          steps={['Account', 'Workspace', 'Review']}
          currentStep={step}
          onBack={
            step > 0
              ? () => {
                  setStep(step - 1);
                }
              : undefined
          }
          onNext={() => {
            setStep(Math.min(step + 1, 2));
          }}
        >
          <p className="text-sm">Step {step + 1} content</p>
        </WizardPage>
      </Sample>
    </>
  );
}
