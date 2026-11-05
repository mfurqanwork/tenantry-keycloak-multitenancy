import {
  InlineLoading,
  RadioButton,
  RadioButtonGroup,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  TextInput,
} from '@carbon/react';
import { APP_LIMITS, APP_TYPES, normaliseUris, type AppType } from '@tenantry/auth';
import { ApiErrorNotification, ApiProblem, useApi, useMe } from '@tenantry/app-kit';
import { WizardPage } from '@tenantry/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { TYPE_HELP, TYPE_LABELS, type AppInput, type AppView, type SecretState } from './api.js';
import { LISTS, listsFor, listsReady, uriProblems, type ListField, type UriLists } from './uri-lists.js';
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
      <Stack gap={6}>
        <ApiErrorNotification error={error} />
        {step === 0 && (
          <RadioButtonGroup
            legendText="What kind of app is it?"
            name="app-type"
            orientation="vertical"
            helperText={type ? TYPE_HELP[type] : 'Choose one to continue.'}
            {...(type ? { valueSelected: type } : {})}
            onChange={(value) => {
              setType(value as AppType);
              setServer({});
            }}
          >
            {APP_TYPES.map((t) => (
              <RadioButton key={t} id={`app-type-${t}`} value={t} labelText={TYPE_LABELS[t]} />
            ))}
          </RadioButtonGroup>
        )}
        {step === 1 && type && (
          <>
            <TextInput
              id="app-name"
              labelText="Name"
              helperText="Shown to you here; people signing in see it too."
              value={name}
              maxLength={APP_LIMITS.nameMax}
              invalid={Boolean(server['name'])}
              invalidText={server['name'] ?? ''}
              onChange={(event) => {
                setName(event.target.value);
                setServer(({ name: _drop, ...others }) => others);
              }}
            />
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
          <StructuredListWrapper aria-label="Review">
            <StructuredListBody>
              <StructuredListRow>
                <StructuredListCell>Type</StructuredListCell>
                <StructuredListCell>{TYPE_LABELS[type]}</StructuredListCell>
              </StructuredListRow>
              <StructuredListRow>
                <StructuredListCell>Name</StructuredListCell>
                <StructuredListCell>{body().name}</StructuredListCell>
              </StructuredListRow>
              {fields.map((field) => (
                <StructuredListRow key={field}>
                  <StructuredListCell>{`${LISTS[field].label}s`}</StructuredListCell>
                  <StructuredListCell>{body()[field].join(', ') || 'None'}</StructuredListCell>
                </StructuredListRow>
              ))}
            </StructuredListBody>
          </StructuredListWrapper>
        )}
        {busy && <InlineLoading description="Registering the app" />}
      </Stack>
    </WizardPage>
  );
}
