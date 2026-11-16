import { APP_LIMITS, APP_TYPES, normaliseUris, type AppType } from '@tenantry/auth';
import { ApiErrorNotification, ApiProblem, Loading, useApi, useMe } from '@tenantry/app-kit';
import {
  FieldError,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  WizardPage,
} from '@tenantry/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { TYPE_HELP, TYPE_LABELS, type AppInput, type AppView, type SecretState } from './api.js';
import { LISTS, listsFor, listsReady, uriProblems, type ListField, type UriLists } from './uri-lists.js';
import { AppTypeIcon } from './AppTypeLabel.js';
import { UriListField } from './UriListField.js';

const STEPS = ['Type', 'Details', 'Review'];
const FIELD = /^(name|redirectUris|postLogoutRedirectUris|webOrigins)(\.\d+)?$/;

// The API answers "redirectUris.1: message; name: message"; each lands on its field.
function fieldErrors(problem: ApiProblem): { fields: Record<string, string>; rest: string[] } {
  const fields: Record<string, string> = {};
  const rest: string[] = [];
  for (const part of problem.detail.split('; ')) {
    const at = part.indexOf(': ');
    const path = at > 0 ? part.slice(0, at) : '';
    if (FIELD.test(path)) fields[path] = part.slice(at + 2);
    else rest.push(part);
  }
  return { fields, rest };
}

export function RegisterAppRoute() {
  const me = useMe();
  const api = useApi();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<AppType | null>(null);
  const [name, setName] = useState('');
  const [lists, setLists] = useState<UriLists>({
    redirectUris: [],
    postLogoutRedirectUris: [],
    webOrigins: [],
  });
  const [server, setServer] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fields = type ? listsFor(type) : [];
  // The API's word on a row wins until that row changes; otherwise the shared rules speak.
  const problems = (field: ListField): (string | null)[] =>
    uriProblems(lists[field], field, type ?? 'web').map((p, i) => server[`${field}.${String(i)}`] ?? p);
  const body = (): AppInput => ({
    name: name.trim(),
    type: type ?? 'web',
    redirectUris: fields.includes('redirectUris') ? normaliseUris(lists.redirectUris) : [],
    postLogoutRedirectUris: fields.includes('postLogoutRedirectUris')
      ? normaliseUris(lists.postLogoutRedirectUris)
      : [],
    webOrigins: fields.includes('webOrigins') ? normaliseUris(lists.webOrigins) : [],
  });
  const detailsReady =
    type !== null &&
    name.trim() !== '' &&
    name.trim().length <= APP_LIMITS.nameMax &&
    listsReady(type, lists) &&
    Object.keys(server).length === 0;

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<{ app: AppView; clientSecret?: string }>('/api/apps', body());
      const state: SecretState = created.clientSecret ? { clientSecret: created.clientSecret } : {};
      void navigate(`/advanced/apps/${created.app.id}`, { state });
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiProblem && err.status === 422) {
        const { fields: found, rest } = fieldErrors(err);
        if (Object.keys(found).length > 0) {
          setServer(found);
          setStep(1);
        }
        if (rest.length > 0) setError(new ApiProblem(err.status, err.title, rest.join('; ')));
        return;
      }
      setError(err);
    }
  }

  const nextDisabled = busy || (step === 0 ? type === null : step === 1 ? !detailsReady : false);

  return (
    <WizardPage
      breadcrumbs={[
        { label: me.tenant.name, href: '/' },
        { label: 'Customer apps', href: '/advanced/apps' },
      ]}
      title="Register an app"
      steps={STEPS}
      currentStep={step}
      {...(step > 0
        ? {
            onBack: () => {
              setStep(step - 1);
            },
          }
        : {})}
      onNext={() => {
        if (step < 2) setStep(step + 1);
        else void register();
      }}
      nextLabel={step === 2 ? 'Register app' : 'Next'}
      nextDisabled={nextDisabled}
    >
      <div className="flex flex-col gap-6">
        <ApiErrorNotification error={error} />
        {step === 0 && (
          <fieldset className="flex flex-col gap-3">
            <legend id="app-type-legend" className="mb-3 text-sm font-medium">
              What kind of app is it?
            </legend>
            <RadioGroup
              aria-labelledby="app-type-legend"
              value={type ?? ''}
              onValueChange={(value) => {
                setType(value as AppType);
                setServer({});
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              {APP_TYPES.map((t) => (
                <div
                  key={t}
                  data-slot="app-type"
                  data-selected={type === t ? 'true' : 'false'}
                  className="relative flex items-start gap-3 rounded-lg border border-border bg-card p-4 data-[selected=true]:border-ring data-[selected=true]:bg-primary-subtle"
                >
                  <RadioGroupItem id={`app-type-${t}`} value={t} aria-describedby={`app-type-${t}-help`} className="mt-0.5" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <Label htmlFor={`app-type-${t}`} className="flex items-center gap-2 after:absolute after:inset-0">
                      <AppTypeIcon type={t} />
                      {TYPE_LABELS[t]}
                    </Label>
                    <p id={`app-type-${t}-help`} className="text-sm text-muted-foreground">
                      {TYPE_HELP[t]}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </fieldset>
        )}
        {step === 1 && type && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="app-name">Name</Label>
              <Input
                id="app-name"
                value={name}
                maxLength={APP_LIMITS.nameMax}
                aria-invalid={Boolean(server['name'])}
                aria-describedby={server['name'] ? 'app-name-error' : 'app-name-help'}
                onChange={(event) => {
                  setName(event.target.value);
                  setServer(({ name: _drop, ...others }) => others);
                }}
              />
              {server['name'] ? (
                <FieldError id="app-name-error">{server['name']}</FieldError>
              ) : (
                <p id="app-name-help" className="text-sm text-muted-foreground">
                  Shown to you here; people signing in see it too.
                </p>
              )}
            </div>
            {fields.map((field) => (
              <UriListField
                key={field}
                id={`app-${field}`}
                label={LISTS[field].label}
                helperText={LISTS[field].helper}
                values={lists[field]}
                problems={problems(field)}
                onChange={(values) => {
                  setLists({ ...lists, [field]: values });
                  setServer((s) =>
                    Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith(field))),
                  );
                }}
              />
            ))}
          </>
        )}
        {step === 2 && type && (
          <Table aria-label="Review">
            <TableBody>
              <TableRow>
                <TableHead scope="row" className="w-48">
                  Type
                </TableHead>
                <TableCell>{TYPE_LABELS[type]}</TableCell>
              </TableRow>
              <TableRow>
                <TableHead scope="row">Name</TableHead>
                <TableCell>{body().name}</TableCell>
              </TableRow>
              {fields.map((field) => (
                <TableRow key={field}>
                  <TableHead scope="row">{`${LISTS[field].label}s`}</TableHead>
                  <TableCell className="font-mono text-sm break-all">{body()[field].join(', ') || 'None'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {busy && <Loading description="Registering the app" />}
      </div>
    </WizardPage>
  );
}
