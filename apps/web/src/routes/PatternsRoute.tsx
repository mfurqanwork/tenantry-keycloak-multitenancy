import { Button, TextInput, Tile } from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { DashboardPage, DetailPage, ListPage, SettingsPage, WizardPage } from '@tenantry/ui';
import { useState, type ReactNode } from 'react';

const noop = () => undefined;

function Sample({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="tenantry-pattern-sample" aria-labelledby={`sample-${name}`}>
      <h2 id={`sample-${name}`} className="tenantry-pattern-sample__name">
        {name}
      </h2>
      <div className="tenantry-pattern-sample__frame">{children}</div>
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
          primaryAction={<Button renderIcon={Add}>Invite member</Button>}
          isEmpty
          emptyState={<Tile>No members yet. Invite someone to get started.</Tile>}
        >
          {null}
        </ListPage>
      </Sample>
      <Sample name="Detail page">
        <DetailPage
          breadcrumbs={[{ label: 'Members', href: '/' }]}
          title="Ada Lovelace"
          summary={<Tile>Role: Admin</Tile>}
          tabs={[
            { label: 'Overview', content: 'Overview content' },
            { label: 'Activity', content: 'Activity content' },
          ]}
        />
      </Sample>
      <Sample name="Settings page">
        <SettingsPage
          title="Tenant settings"
          dirty={name !== 'Acme'}
          saving={false}
          onSave={noop}
          onDiscard={() => {
            setName('Acme');
          }}
        >
          <TextInput
            id="tenant-name"
            labelText="Tenant name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </SettingsPage>
      </Sample>
      <Sample name="Dashboard">
        <DashboardPage
          title="Overview"
          tiles={[<Tile key="a">12 members</Tile>, <Tile key="b">3 apps</Tile>]}
        />
      </Sample>
      <Sample name="Wizard">
        <WizardPage
          title="Create a tenant"
          steps={['Account', 'Tenant', 'Review']}
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
          Step {step + 1} content
        </WizardPage>
      </Sample>
    </>
  );
}
