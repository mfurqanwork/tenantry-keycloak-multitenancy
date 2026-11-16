import { Loading, RouterLink, useMe } from '@tenantry/app-kit';
import { finishTestLogin, type TestLoginResult } from '@tenantry/oidc-client';
import { Page, PageHeader, Table, TableBody, TableCell, TableHead, TableRow } from '@tenantry/ui';
import { ArrowLeft, LogIn } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Notice } from './Notice.js';

// Where a customer app's test sign-in comes back (its client lists this address). Reads the answer once.
export function TestCallbackRoute() {
  const me = useMe();
  const location = useLocation();
  const [result, setResult] = useState<TestLoginResult | null>(null);
  const read = useRef(false);
  useEffect(() => {
    if (read.current) return;
    read.current = true;
    const url = new URL(`${location.pathname}${location.search}`, window.location.origin).toString();
    void finishTestLogin(url).then(setResult, (err: unknown) => {
      setResult({
        kind: 'error',
        appId: null,
        error: 'request_failed',
        description: err instanceof Error ? err.message : null,
      });
    });
  }, [location]);

  const appId = result && result.kind !== 'expired' ? result.appId : null;
  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: me.tenant.name, href: '/' },
          { label: 'Customer apps', href: '/advanced/apps' },
        ]}
        title="Test sign-in"
        icon={LogIn}
      />
      {!result && <Loading description="Reading Keycloak's answer" />}
      {result?.kind === 'claims' && (
        <>
          <Notice
            tone="success"
            title="Sign-in works"
            detail="Keycloak signed you in to this app and issued these claims."
          />
          <Table aria-label="Token claims">
            <TableBody>
              {(
                [
                  ['Issuer', result.claims.iss],
                  ['Subject', result.claims.sub],
                  ['Audience', [result.claims.aud].flat().join(', ')],
                  ['Expires', new Date(result.claims.exp * 1000).toLocaleString()],
                ] as const
              ).map(([label, value]) => (
                <TableRow key={label}>
                  <TableHead scope="row" className="w-1/3 font-medium text-foreground">
                    {label}
                  </TableHead>
                  <TableCell className="font-mono text-sm whitespace-normal break-all">{value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
      {result?.kind === 'signed-in' && (
        <Notice
          tone="success"
          title="Sign-in works"
          detail={`Keycloak signed you in (${me.user.email ?? 'you'}) for this app.`}
        />
      )}
      {result?.kind === 'error' && (
        <Notice
          tone="error"
          title="Sign-in failed"
          detail={result.description ? `${result.error}: ${result.description}` : result.error}
        />
      )}
      {result?.kind === 'expired' && (
        <Notice tone="warning" title="This test sign-in has expired. Start it again." />
      )}
      {result && (
        <div>
          <RouterLink
            href={appId ? `/advanced/apps/${appId}` : '/advanced/apps'}
            className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm font-medium text-link underline-offset-4 outline-none hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {appId ? 'Back to the app' : 'Back to applications'}
          </RouterLink>
        </div>
      )}
    </Page>
  );
}
