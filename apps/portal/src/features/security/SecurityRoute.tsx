import { SECURITY_BOUNDS, securityProblems, type SecuritySettings, type TwoStep } from '@tenantry/auth';
import { ApiErrorNotification, Loading, useApi, useMe, useResource } from '@tenantry/app-kit';
import { FieldError, Input, Label, RadioGroup, RadioGroupItem, SettingsPage } from '@tenantry/ui';
import { CircleCheck, Clock, KeyRound, Lock, ShieldCheck, Smartphone, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { EnterpriseOnlyPage } from '../../lib/enterprise-only.js';

type NumberField = keyof typeof SECURITY_BOUNDS;

const TWO_STEP: { value: TwoStep; label: string }[] = [
  { value: 'off', label: 'Off: a password is enough' },
  { value: 'optional', label: 'Optional: people who set up a second step use it' },
  { value: 'required', label: 'Required: everyone sets up an authenticator app' },
];

const GROUPS: {
  legend: string;
  icon: LucideIcon;
  fields: { key: NumberField; label: string; unit: string; help?: string }[];
}[] = [
  {
    legend: 'Passwords',
    icon: KeyRound,
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
    icon: Clock,
    fields: [
      { key: 'sessionIdleMinutes', label: 'Idle timeout (minutes)', unit: 'minutes' },
      { key: 'sessionMaxHours', label: 'Longest session (hours)', unit: 'hours' },
    ],
  },
  {
    legend: 'Lockout',
    icon: Lock,
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

// One settings group: a fieldset on a card, its legend with an icon.
function Group({ legend, icon: Icon, children }: { legend: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <legend className="float-left mb-1 flex w-full items-center gap-2 text-base font-semibold">
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

const header = {
  title: 'Sign-in & security',
  icon: ShieldCheck,
  description: 'Two-step sign-in, passwords, sessions and lockout.',
};

// The sign-in rules of the workspace's own realm (owners: tenant:settings). The form checks with the
// API's own rules (@tenantry/auth), and the API checks again.
export function SecurityRoute() {
  const me = useMe();
  if (me.tenant.tier !== 'enterprise') {
    return <EnterpriseOnlyPage {...header} />;
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
      {...header}
      dirty={changed && valid}
      saving={saving}
      onSave={() => void save()}
      onDiscard={() => {
        setDraft(null);
        setError(null);
      }}
    >
      <ApiErrorNotification error={saved.error ?? error} />
      <div role="status">
        {done && (
          <p className="flex items-start gap-2 rounded-lg border border-success/40 bg-success-muted p-3 text-sm">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
            <span>
              <span className="font-medium">Security settings saved.</span>{' '}
              <span className="text-muted-foreground">They apply to the next sign-in.</span>
            </span>
          </p>
        )}
      </div>
      {!value && !saved.error && <Loading description="Loading security settings" />}
      {value && (
        <>
          <Group legend="Two-step sign-in" icon={Smartphone}>
            <RadioGroup
              aria-label="Two-step sign-in"
              value={value.twoStep}
              onValueChange={(v) => {
                set('twoStep', v as TwoStep);
              }}
              className="flex flex-col gap-3"
            >
              {TWO_STEP.map((o) => (
                <div key={o.value} className="flex items-center gap-2">
                  <RadioGroupItem id={`two-step-${o.value}`} value={o.value} />
                  <Label htmlFor={`two-step-${o.value}`} className="font-normal">
                    {o.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </Group>
          <div className="grid gap-6 lg:grid-cols-3">
            {GROUPS.map((group) => (
              <Group key={group.legend} legend={group.legend} icon={group.icon}>
                {group.fields.map((f) => {
                  const id = `security-${f.key}`;
                  const problem = problems[f.key];
                  return (
                    <div key={f.key} className="flex flex-col gap-2">
                      <Label htmlFor={id}>{f.label}</Label>
                      <Input
                        id={id}
                        type="number"
                        inputMode="numeric"
                        className="tabular-nums"
                        min={SECURITY_BOUNDS[f.key].min}
                        max={SECURITY_BOUNDS[f.key].max}
                        value={Number.isNaN(value[f.key]) ? '' : value[f.key]}
                        aria-invalid={Boolean(problem)}
                        aria-describedby={problem ? `${id}-error` : `${id}-help`}
                        onChange={(event) => {
                          const v = event.target.value;
                          set(f.key, v === '' ? Number.NaN : Number(v));
                        }}
                      />
                      {problem ? (
                        <FieldError id={`${id}-error`}>{problem}</FieldError>
                      ) : (
                        <p id={`${id}-help`} className="text-sm text-muted-foreground">
                          {helper(f.key, f.unit, f.help)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </Group>
            ))}
          </div>
        </>
      )}
    </SettingsPage>
  );
}
