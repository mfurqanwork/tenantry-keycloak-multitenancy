import {
  InlineLoading,
  InlineNotification,
  Link,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
} from '@carbon/react';
import { RouterLink, useMe } from '@tenantry/app-kit';
import { finishTestLogin, type TestLoginResult } from '@tenantry/oidc-client';
import { PageHeader } from '@tenantry/ui';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

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
    <div className="tenantry-page">
      <PageHeader
        breadcrumbs={[
          { label: me.tenant.name, href: '/' },
          { label: 'Customer apps', href: '/advanced/apps' },
        ]}
        title="Test sign-in"
      />
      <div className="tenantry-page__body">
        <Stack gap={6}>
          {!result && <InlineLoading description="Reading Keycloak's answer" />}
          {result?.kind === 'claims' && (
            <>
              <InlineNotification
                kind="success"
                lowContrast
                hideCloseButton
                title="Sign-in works"
                subtitle="Keycloak signed you in to this app and issued these claims."
              />
              <StructuredListWrapper aria-label="Token claims">
                <StructuredListBody>
                  {(
                    [
                      ['Issuer', result.claims.iss],
                      ['Subject', result.claims.sub],
                      ['Audience', [result.claims.aud].flat().join(', ')],
                      ['Expires', new Date(result.claims.exp * 1000).toLocaleString()],
                    ] as const
                  ).map(([label, value]) => (
                    <StructuredListRow key={label}>
                      <StructuredListCell>{label}</StructuredListCell>
                      <StructuredListCell>{value}</StructuredListCell>
                    </StructuredListRow>
                  ))}
                </StructuredListBody>
              </StructuredListWrapper>
            </>
          )}
          {result?.kind === 'signed-in' && (
            <InlineNotification
              kind="success"
              lowContrast
              hideCloseButton
              title="Sign-in works"
              subtitle={`Keycloak signed you in (${me.user.email ?? 'you'}) for this app.`}
            />
          )}
          {result?.kind === 'error' && (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title="Sign-in failed"
              subtitle={result.description ? `${result.error}: ${result.description}` : result.error}
            />
          )}
          {result?.kind === 'expired' && (
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title="This test sign-in has expired. Start it again."
            />
          )}
          {result &&
            (appId ? (
              <Link as={RouterLink} href={`/advanced/apps/${appId}`}>
                Back to the app
              </Link>
            ) : (
              <Link as={RouterLink} href="/advanced/apps">
                Back to applications
              </Link>
            ))}
        </Stack>
      </div>
    </div>
  );
}
