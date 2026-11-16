import { confidential } from '@tenantry/auth';
import { ApiErrorNotification, Loading, useApi, useMe, useResource } from '@tenantry/app-kit';
import { startTestLogin } from '@tenantry/oidc-client';
import {
  Button,
  CodeSnippet,
  DetailPage,
  Input,
  Label,
  Page,
  PageHeader,
  StatTile,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TileGrid,
} from '@tenantry/ui';
import { AppWindow, CalendarClock, KeyRound, LogIn, Pencil, RotateCw, Shapes, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { type AppView, type SecretState } from './api.js';
import { DeleteAppDialog, EditAppDialog, RotateSecretDialog } from './AppDialogs.js';
import { AppTypeLabel } from './AppTypeLabel.js';
import { Notice } from './Notice.js';
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
    { label: 'Customer apps', href: '/advanced/apps' },
  ];
  if (!app.data) {
    return (
      <Page>
        <PageHeader breadcrumbs={crumbs} title="Application" icon={AppWindow} />
        <ApiErrorNotification error={app.error} />
        {!app.error && <Loading description="Loading the app" />}
      </Page>
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
        icon={AppWindow}
        actions={
          registers ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setDialog('edit');
                }}
              >
                <Pencil aria-hidden="true" />
                Edit
              </Button>
              {confidential(a.type) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialog('rotate');
                  }}
                >
                  <RotateCw aria-hidden="true" />
                  Rotate secret
                </Button>
              )}
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive-muted hover:text-destructive"
                onClick={() => {
                  setDialog('delete');
                }}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            </>
          ) : undefined
        }
        summary={
          <div className="flex flex-col gap-6">
            {secret && (
              <Notice
                tone="warning"
                title="Copy the client secret now"
                detail="It won't be shown again. If it is lost, rotate it for a new one."
              >
                <CodeSnippet label="Client secret" className="bg-background">
                  {secret}
                </CodeSnippet>
              </Notice>
            )}
            <TileGrid>
              {[
                <StatTile key="type" icon={Shapes} label="Type" value={<AppTypeLabel type={a.type} />} />,
                <StatTile
                  key="client"
                  icon={KeyRound}
                  label="Client ID"
                  value={<span className="font-mono text-base break-all">{a.clientId}</span>}
                />,
                <StatTile
                  key="registered"
                  icon={CalendarClock}
                  label="Registered"
                  value={new Date(a.createdAt).toLocaleDateString()}
                />,
              ]}
            </TileGrid>
          </div>
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
            void navigate('/advanced/apps');
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
  const head = 'w-1/3 align-top font-medium text-foreground whitespace-normal';
  return (
    <Table aria-label="Connection details">
      <TableBody>
        {rows.map(([label, value]) => (
          <TableRow key={label}>
            <TableHead scope="row" className={head}>
              {label}
            </TableHead>
            <TableCell>
              <CodeSnippet label={label}>{value}</CodeSnippet>
            </TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableHead scope="row" className={head}>
            Client secret
          </TableHead>
          <TableCell className="whitespace-normal text-muted-foreground">
            {confidential(app.type) ? 'Shown once, when registered or rotated' : 'None (public client, PKCE)'}
          </TableCell>
        </TableRow>
        {app.type !== 'm2m' && (
          <TableRow>
            <TableHead scope="row" className={head}>
              Redirect URIs
            </TableHead>
            <TableCell className="font-mono text-sm whitespace-normal break-all">
              {app.redirectUris.join(', ')}
            </TableCell>
          </TableRow>
        )}
        {c.testRedirectUri && (
          <TableRow>
            <TableHead scope="row" className={head}>
              Tenantry test sign-in (kept by Tenantry)
            </TableHead>
            <TableCell className="font-mono text-sm whitespace-normal break-all">{c.testRedirectUri}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function SetUp({ app }: { app: AppView }) {
  const snippets = snippetsFor(app);
  if (snippets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Use the connection details with your platform&apos;s OpenID Connect library (AppAuth on iOS and
        Android), with PKCE and one of the redirect URIs above.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {snippets.map((s) => (
        <section key={s.label} aria-label={s.label} className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{s.label}</h2>
          <CodeSnippet label={s.label} multiline>
            {s.code}
          </CodeSnippet>
        </section>
      ))}
    </div>
  );
}

function TestSignIn({ app, enabled }: { app: AppView; enabled: boolean }) {
  const c = app.connection;
  if (!enabled || !c.testRedirectUri) {
    return <p className="text-sm text-muted-foreground">Owners and admins can run a test sign-in here.</p>;
  }
  const redirectUri = c.testRedirectUri;
  return (
    <div className="flex max-w-prose flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {app.type === 'web'
          ? 'Signs you in to this app through Keycloak and comes back here. Its secret is not needed: the test stops once Keycloak hands back the sign-in code.'
          : 'Signs you in to this app through Keycloak with PKCE and shows the token it receives.'}
      </p>
      <div>
        <Button
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
          <LogIn aria-hidden="true" />
          Test sign-in
        </Button>
      </div>
    </div>
  );
}

function TokenCheck({ app, enabled }: { app: AppView; enabled: boolean }) {
  const api = useApi();
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  if (!enabled) {
    return <p className="text-sm text-muted-foreground">Owners and admins can request a test token here.</p>;
  }
  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setResult(null);
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
      <p className="text-sm text-muted-foreground">
        Paste the app&apos;s client secret: Tenantry asks Keycloak for one token with it and keeps nothing.
      </p>
      <ApiErrorNotification error={error} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="token-check-secret">Client secret</Label>
        <Input
          id="token-check-secret"
          type="password"
          autoComplete="off"
          className="font-mono"
          value={secret}
          onChange={(event) => {
            setSecret(event.target.value);
          }}
        />
      </div>
      <div>
        <Button type="submit" disabled={busy || secret === ''}>
          <KeyRound aria-hidden="true" />
          Request a token
        </Button>
      </div>
      {busy && <Loading description="Asking Keycloak for a token" />}
      {result &&
        (result.ok ? (
          <Notice tone="success" title="Keycloak issued a token for this app." />
        ) : (
          <Notice tone="error" title="Keycloak refused" detail={result.error ?? null} />
        ))}
    </form>
  );
}
