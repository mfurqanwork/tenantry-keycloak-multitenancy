import {
  Button,
  CodeSnippet,
  Column,
  Grid,
  InlineLoading,
  InlineNotification,
  PasswordInput,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
} from '@carbon/react';
import { confidential } from '@tenantry/auth';
import { ApiErrorNotification, useApi, useMe, useResource } from '@tenantry/app-kit';
import { startTestLogin } from '@tenantry/oidc-client';
import { DetailPage } from '@tenantry/ui';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { StatTile } from '../dashboard/DashboardRoute.js';
import { TYPE_LABELS, type AppView, type SecretState } from './api.js';
import { DeleteAppDialog, EditAppDialog, RotateSecretDialog } from './AppDialogs.js';
import { snippetsFor } from './snippets.js';

type Dialog = 'edit' | 'rotate' | 'delete' | null;

// One customer app: what to plug into it, how to set it up, and a test that it signs in (ADR-0011).
export function AppDetailRoute() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const me = useMe();
  const app = useResource<AppView>(`/api/apps/${encodeURIComponent(id)}`);
  // The secret arrives once in router state; it is dropped from history at once, so a reload loses it.
  const [secret, setSecret] = useState<string | null>(
    (location.state as SecretState | null)?.clientSecret ?? null,
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  useEffect(() => {
    if ((location.state as SecretState | null)?.clientSecret) {
      void navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  const crumbs = [
    { label: me.tenant.name, href: '/' },
    { label: 'Applications', href: '/applications' },
  ];
  if (!app.data) {
    return (
      <div className="tenantry-page">
        <div className="tenantry-page__body">
          <ApiErrorNotification error={app.error} />
          {!app.error && <InlineLoading description="Loading the app" />}
        </div>
      </div>
    );
  }
  const a = app.data;
  const registers = me.can('apps:register');
  const close = () => {
    setDialog(null);
  };

  return (
    <>
      <DetailPage
        breadcrumbs={crumbs}
        title={a.name}
        actions={
          registers ? (
            <>
              <Button
                kind="tertiary"
                onClick={() => {
                  setDialog('edit');
                }}
              >
                Edit
              </Button>
              {confidential(a.type) && (
                <Button
                  kind="tertiary"
                  onClick={() => {
                    setDialog('rotate');
                  }}
                >
                  Rotate secret
                </Button>
              )}
              <Button
                kind="danger--ghost"
                onClick={() => {
                  setDialog('delete');
                }}
              >
                Delete
              </Button>
            </>
          ) : undefined
        }
        summary={
          <Stack gap={6}>
            {secret && (
              <Stack gap={3}>
                <InlineNotification
                  kind="warning"
                  lowContrast
                  hideCloseButton
                  title="Copy the client secret now"
                  subtitle="It won't be shown again. If it is lost, rotate it for a new one."
                />
                <CodeSnippet type="single" feedback="Copied" aria-label="Client secret">
                  {secret}
                </CodeSnippet>
              </Stack>
            )}
            <Grid narrow className="tenantry-dashboard__tiles">
              {(
                [
                  ['Type', TYPE_LABELS[a.type]],
                  ['Client ID', a.clientId],
                  ['Registered', new Date(a.createdAt).toLocaleDateString()],
                ] as const
              ).map(([label, value]) => (
                <Column key={label} sm={4} md={4} lg={4}>
                  <StatTile label={label} value={value} />
                </Column>
              ))}
            </Grid>
          </Stack>
        }
        tabs={[
          { label: 'Connection details', content: <ConnectionDetails app={a} /> },
          { label: 'Set up', content: <SetUp app={a} /> },
          a.type === 'm2m'
            ? { label: 'Request a token', content: <TokenCheck app={a} enabled={registers} /> }
            : { label: 'Test', content: <TestSignIn app={a} enabled={registers} /> },
        ]}
      />
      {dialog === 'edit' && <EditAppDialog app={a} onDone={app.reload} onClose={close} />}
      {dialog === 'rotate' && <RotateSecretDialog app={a} onRotated={setSecret} onClose={close} />}
      {dialog === 'delete' && (
        <DeleteAppDialog
          app={a}
          onDeleted={() => {
            void navigate('/applications');
          }}
          onClose={close}
        />
      )}
    </>
  );
}

function ConnectionDetails({ app }: { app: AppView }) {
  const c = app.connection;
  const rows: [string, string][] = [
    ['Issuer', c.issuer],
    ['Discovery URL', c.discoveryUrl],
    ['Authorization endpoint', c.authorizationEndpoint],
    ['Token endpoint', c.tokenEndpoint],
    ['JWKS URL (for verifying tokens)', c.jwksUri],
    ['End-session (logout) endpoint', c.endSessionEndpoint],
    ['Client ID', c.clientId],
    ['Scopes', c.scopes],
  ];
  return (
    <StructuredListWrapper aria-label="Connection details">
      <StructuredListBody>
        {rows.map(([label, value]) => (
          <StructuredListRow key={label}>
            <StructuredListCell>{label}</StructuredListCell>
            <StructuredListCell>
              <CodeSnippet type="single" feedback="Copied">
                {value}
              </CodeSnippet>
            </StructuredListCell>
          </StructuredListRow>
        ))}
        <StructuredListRow>
          <StructuredListCell>Client secret</StructuredListCell>
          <StructuredListCell>
            {confidential(app.type) ? 'Shown once, when registered or rotated' : 'None (public client, PKCE)'}
          </StructuredListCell>
        </StructuredListRow>
        {app.type !== 'm2m' && (
          <StructuredListRow>
            <StructuredListCell>Redirect URIs</StructuredListCell>
            <StructuredListCell>{app.redirectUris.join(', ')}</StructuredListCell>
          </StructuredListRow>
        )}
        {c.testRedirectUri && (
          <StructuredListRow>
            <StructuredListCell>Tenantry test sign-in (kept by Tenantry)</StructuredListCell>
            <StructuredListCell>{c.testRedirectUri}</StructuredListCell>
          </StructuredListRow>
        )}
      </StructuredListBody>
    </StructuredListWrapper>
  );
}

function SetUp({ app }: { app: AppView }) {
  const snippets = snippetsFor(app);
  if (snippets.length === 0) {
    return (
      <p>
        Use the connection details with your platform&apos;s OpenID Connect library (AppAuth on iOS and
        Android), with PKCE and one of the redirect URIs above.
      </p>
    );
  }
  return (
    <Stack gap={6}>
      {snippets.map((s) => (
        <section key={s.label} aria-label={s.label}>
          <h2 className="tenantry-section__title">{s.label}</h2>
          <CodeSnippet type="multi" feedback="Copied">
            {s.code}
          </CodeSnippet>
        </section>
      ))}
    </Stack>
  );
}

function TestSignIn({ app, enabled }: { app: AppView; enabled: boolean }) {
  const c = app.connection;
  if (!enabled || !c.testRedirectUri) {
    return <p>Owners and admins can run a test sign-in here.</p>;
  }
  const redirectUri = c.testRedirectUri;
  return (
    <Stack gap={5}>
      <p>
        {app.type === 'web'
          ? 'Signs you in to this app through Keycloak and comes back here. Its secret is not needed: the test stops once Keycloak hands back the sign-in code.'
          : 'Signs you in to this app through Keycloak with PKCE and shows the token it receives.'}
      </p>
      <div>
        <Button
          kind="primary"
          onClick={() => {
            void startTestLogin({
              appId: app.id,
              clientId: app.clientId,
              authorizationEndpoint: c.authorizationEndpoint,
              tokenEndpoint: c.tokenEndpoint,
              redirectUri,
              exchange: app.type !== 'web',
            });
          }}
        >
          Test sign-in
        </Button>
      </div>
    </Stack>
  );
}

function TokenCheck({ app, enabled }: { app: AppView; enabled: boolean }) {
  const api = useApi();
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  if (!enabled) return <p>Owners and admins can request a test token here.</p>;
  return (
    <Stack gap={5}>
      <p>
        Paste the app&apos;s client secret: Tenantry asks Keycloak for one token with it and keeps nothing.
      </p>
      <ApiErrorNotification error={error} />
      <PasswordInput
        id="token-check-secret"
        labelText="Client secret"
        value={secret}
        onChange={(event) => {
          setSecret(event.target.value);
        }}
      />
      <div>
        <Button
          disabled={busy || secret === ''}
          onClick={() => {
            setBusy(true);
            setError(null);
            api
              .post<{ ok: boolean; error?: string }>(`/api/apps/${app.id}/token-check`, {
                clientSecret: secret,
              })
              .then(setResult, setError)
              .finally(() => {
                setBusy(false);
              });
          }}
        >
          Request a token
        </Button>
      </div>
      {result && (
        <InlineNotification
          kind={result.ok ? 'success' : 'error'}
          lowContrast
          hideCloseButton
          title={result.ok ? 'Keycloak issued a token for this app.' : 'Keycloak refused'}
          subtitle={result.ok ? '' : (result.error ?? '')}
        />
      )}
    </Stack>
  );
}
