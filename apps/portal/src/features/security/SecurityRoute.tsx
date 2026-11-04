import {
  FormGroup,
  InlineNotification,
  NumberInput,
  RadioButton,
  RadioButtonGroup,
  Stack,
  Tile,
} from '@carbon/react';
import { SECURITY_BOUNDS, securityProblems, type SecuritySettings, type TwoStep } from '@tenantry/auth';
import { ApiErrorNotification, useApi, useMe, useResource } from '@tenantry/app-kit';
import { SettingsPage } from '@tenantry/ui';
import { useState } from 'react';

type NumberField = keyof typeof SECURITY_BOUNDS;

export const ENTERPRISE_ONLY = 'Security settings and SCIM are available on Enterprise workspaces.';

const TWO_STEP: { value: TwoStep; label: string }[] = [
  { value: 'off', label: 'Off: a password is enough' },
  { value: 'optional', label: 'Optional: people who set up a second step use it' },
  { value: 'required', label: 'Required: everyone sets up an authenticator app' },
];

const GROUPS: {
  legend: string;
  fields: { key: NumberField; label: string; unit: string; help?: string }[];
}[] = [
  {
    legend: 'Passwords',
    fields: [
      { key: 'passwordMinLength', label: 'Minimum length', unit: 'characters' },
      {
        key: 'passwordHistory',
        label: 'Passwords remembered',
        unit: 'earlier passwords',
        help: '0 lets people reuse any.',
      },
      { key: 'passwordExpiryDays', label: 'Expiry (days)', unit: 'days', help: '0 means never.' },
    ],
  },
  {
    legend: 'Sessions',
    fields: [
      { key: 'sessionIdleMinutes', label: 'Idle timeout (minutes)', unit: 'minutes' },
      { key: 'sessionMaxHours', label: 'Longest session (hours)', unit: 'hours' },
    ],
  },
  {
    legend: 'Lockout',
    fields: [
      { key: 'lockoutFailures', label: 'Failed attempts before lockout', unit: 'attempts' },
      { key: 'lockoutWaitMinutes', label: 'Wait after a lockout (minutes)', unit: 'minutes' },
    ],
  },
];

const helper = (key: NumberField, unit: string, help?: string) => {
  const { min, max } = SECURITY_BOUNDS[key];
  return `From ${String(min)} to ${String(max)} ${unit}.${help ? ` ${help}` : ''}`;
};

// The sign-in rules of the workspace's own realm (owners: tenant:settings). The form checks with the
// API's own rules (@tenantry/auth), and the API checks again.
export function SecurityRoute() {
  const me = useMe();
  if (me.tenant.tier !== 'enterprise') {
    return (
      <SettingsPage
        breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
        title="Security"
        dirty={false}
        saving={false}
        onSave={() => undefined}
        onDiscard={() => undefined}
      >
        <Tile>{ENTERPRISE_ONLY}</Tile>
      </SettingsPage>
    );
  }
  return <EnterpriseSecurity />;
}

function EnterpriseSecurity() {
  const me = useMe();
  const api = useApi();
  const saved = useResource<SecuritySettings>('/api/security');
  const [draft, setDraft] = useState<SecuritySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  const value = draft ?? saved.data;
  const problems = value ? securityProblems(value) : {};
  const valid = Object.keys(problems).length === 0;
  const changed = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved.data);

  function set<K extends keyof SecuritySettings>(key: K, v: SecuritySettings[K]) {
    if (!value) return;
    setDone(false);
    setDraft({ ...value, [key]: v });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await api.put('/api/security', draft);
      saved.reload();
      setDraft(null);
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPage
      breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
      title="Security"
      dirty={changed && valid}
      saving={saving}
      onSave={() => void save()}
      onDiscard={() => {
        setDraft(null);
        setError(null);
      }}
    >
      <Stack gap={6}>
        <ApiErrorNotification error={saved.error ?? error} />
        {done && (
          <InlineNotification
            kind="success"
            lowContrast
            hideCloseButton
            title="Security settings saved."
            subtitle="They apply to the next sign-in."
          />
        )}
        {value && (
          <>
            <RadioButtonGroup
              legendText="Two-step sign-in"
              name="two-step"
              orientation="vertical"
              valueSelected={value.twoStep}
              onChange={(v) => {
                set('twoStep', v as TwoStep);
              }}
            >
              {TWO_STEP.map((o) => (
                <RadioButton key={o.value} id={`two-step-${o.value}`} value={o.value} labelText={o.label} />
              ))}
            </RadioButtonGroup>
            {GROUPS.map((group) => (
              <FormGroup key={group.legend} legendText={group.legend}>
                <Stack gap={5}>
                  {group.fields.map((f) => (
                    <NumberInput
                      key={f.key}
                      id={`security-${f.key}`}
                      label={f.label}
                      helperText={helper(f.key, f.unit, f.help)}
                      min={SECURITY_BOUNDS[f.key].min}
                      max={SECURITY_BOUNDS[f.key].max}
                      allowEmpty
                      value={Number.isNaN(value[f.key]) ? '' : value[f.key]}
                      invalid={Boolean(problems[f.key])}
                      invalidText={problems[f.key]}
                      onChange={(_event, { value: v }) => {
                        set(f.key, v === '' ? Number.NaN : Number(v));
                      }}
                    />
                  ))}
                </Stack>
              </FormGroup>
            ))}
          </>
        )}
      </Stack>
    </SettingsPage>
  );
}
