import { brandTokens } from '@tenantry/brand';
import { applyBrand, buttonVariants, cn, TechLogo, TenantryMark, TenantryThemeProvider, type TechName } from '@tenantry/ui';
import { kcSanitize } from 'keycloakify/lib/kcSanitize';
import { useInitialize } from 'keycloakify/login/Template.useInitialize';
import type { TemplateProps } from 'keycloakify/login/TemplateProps';
import { CircleAlert, CircleCheck, Info, KeyRound, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { I18n } from './i18n.js';
import type { KcContext } from './KcContext.js';
import { loadTenantBrand, tenantFromLocation, type TenantBrand } from './tenant-brand.js';

const MESSAGE = {
  success: { icon: CircleCheck, box: 'border-success/40 bg-success-muted', mark: 'text-success' },
  warning: { icon: TriangleAlert, box: 'border-warning/40 bg-warning-muted', mark: 'text-warning' },
  error: { icon: CircleAlert, box: 'border-destructive/30 bg-destructive-muted', mark: 'text-destructive' },
  info: { icon: Info, box: 'border-border bg-muted', mark: 'text-muted-foreground' },
} as const;

interface Provider {
  alias: string;
  providerId: string;
  displayName: string;
  loginUrl: string;
}

// A provider's own logo where we have one; otherwise a key, for a company's own identity provider.
const LOGOS: Record<string, TechName> = { github: 'github', okta: 'okta', 'keycloak-oidc': 'keycloak' };
function logoOf(p: Provider): TechName | null {
  return LOGOS[p.providerId] ?? LOGOS[p.alias.toLowerCase()] ?? null;
}

const linkClass =
  'rounded-sm font-medium text-link underline-offset-4 outline-none hover:underline focus-ring';

export default function Template(props: TemplateProps<KcContext, I18n>) {
  return (
    <TenantryThemeProvider>
      <Frame {...props} />
    </TenantryThemeProvider>
  );
}

// The frame around every Keycloak page: the workspace (or Tenantry) above a card holding the page's title
// or the attempted username, Keycloak's message, company sign-in first, the page body, "try another way",
// and the info line under the card.
function Frame(props: TemplateProps<KcContext, I18n>) {
  const {
    displayInfo = false,
    displayMessage = true,
    headerNode,
    socialProvidersNode = null,
    infoNode = null,
    documentTitle,
    kcContext,
    i18n,
    doUseDefaultCss,
    children,
  } = props;
  const { msg, msgStr } = i18n;
  const { realm, auth, url, message, isAppInitiatedAction } = kcContext;

  useEffect(() => {
    document.title = documentTitle ?? msgStr('loginTitle', realm.displayName || realm.name);
  }, [documentTitle, msgStr, realm.displayName, realm.name]);

  // The workspace this sign-in is for, when the app's address says so (ADR-0021).
  const [brand, setBrand] = useState<TenantBrand | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tenant = tenantFromLocation(
      window.location.search,
      window.sessionStorage,
      kcContext.properties.TENANTRY_BASE_DOMAIN,
    );
    if (!tenant) return;
    let current = true;
    void loadTenantBrand(tenant).then((found) => {
      if (current) setBrand(found);
    });
    return () => {
      current = false;
    };
  }, []);
  const color = brand?.primaryColor ?? null;
  useEffect(() => {
    if (frame.current) applyBrand(color ? brandTokens(color) : null, frame.current);
  });

  const { isReadyToRender } = useInitialize({ kcContext, doUseDefaultCss });
  if (!isReadyToRender) return null;

  const showMessage =
    displayMessage && message !== undefined && (message.type !== 'warning' || !isAppInitiatedAction);
  // The page asks for its providers by passing a node; we draw them ourselves, first, as buttons.
  const providers: Provider[] =
    socialProvidersNode !== null && 'social' in kcContext ? (kcContext.social?.providers ?? []) : [];
  const tone = message ? MESSAGE[message.type] : null;

  return (
    <div
      ref={frame}
      data-tenantry-theme=""
      className="tenantry-login flex min-h-dvh flex-col items-center bg-muted px-4 py-10 text-foreground sm:py-16"
    >
      <main className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex min-h-10 items-center justify-center gap-3">
          {brand ? (
            <>
              {brand.logoUrl && <img className="h-10 w-auto max-w-40 object-contain" src={brand.logoUrl} alt={brand.name} />}
              <span data-slot="workspace-name" className="text-lg font-semibold tracking-tight">
                {brand.name}
              </span>
            </>
          ) : (
            // No workspace applies (the base domain's sign-in and registration): Tenantry's own logo.
            <span role="img" aria-label="Tenantry">
              <TenantryMark variant="logo" className="h-8" />
            </span>
          )}
        </header>

        <section
          aria-labelledby="kc-page-title"
          className="flex flex-col gap-5 rounded-xl border border-border bg-card px-6 py-7 shadow-raised sm:px-8"
        >
          {auth?.showUsername && !auth.showResetCredentials ? (
            <div className="flex flex-col gap-3">
              <h1 id="kc-page-title" className="text-xl font-semibold tracking-tight text-balance">
                {headerNode}
              </h1>
              <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 py-1.5 pr-1.5 pl-3 text-sm">
                <span className="truncate font-medium">{auth.attemptedUsername}</span>
                <a
                  data-slot="restart"
                  href={url.loginRestartFlowUrl}
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0 text-link')}
                >
                  {msg('restartLoginTooltip')}
                </a>
              </div>
            </div>
          ) : (
            <h1 id="kc-page-title" className="text-xl font-semibold tracking-tight text-balance">
              {headerNode}
            </h1>
          )}

          {showMessage && tone && (
            <div
              role={message.type === 'error' ? 'alert' : 'status'}
              className={cn('flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm', tone.box)}
            >
              <tone.icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', tone.mark)} />
              <span dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }} />
            </div>
          )}

          {providers.length > 0 && (
            <>
              <ul aria-label="Sign in with" className="flex flex-col gap-2">
                {providers.map((p) => {
                  const logo = logoOf(p);
                  return (
                    <li key={p.alias}>
                      <a
                        id={`social-${p.alias}`}
                        data-slot="provider"
                        href={p.loginUrl}
                        className={cn(buttonVariants({ variant: 'outline' }), 'h-10 w-full gap-2.5 shadow-xs')}
                      >
                        {logo ? (
                          <span data-logo={logo} className="contents">
                            <TechLogo name={logo} size={18} decorative />
                          </span>
                        ) : (
                          <KeyRound data-logo="key" aria-hidden="true" className="size-4.5 text-muted-foreground" />
                        )}
                        {`Continue with ${p.displayName}`}
                      </a>
                    </li>
                  );
                })}
              </ul>
              {'password' in realm && realm.password && (
                <p className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span aria-hidden="true" className="h-px flex-1 bg-border" />
                  or sign in with a password
                  <span aria-hidden="true" className="h-px flex-1 bg-border" />
                </p>
              )}
            </>
          )}

          {children}

          {auth?.showTryAnotherWayLink && (
            <form id="kc-select-try-another-way-form" action={url.loginAction} method="post">
              <input type="hidden" name="tryAnotherWay" value="on" />
              <button type="submit" className={cn(buttonVariants({ variant: 'ghost' }), 'w-full text-link')}>
                {msg('doTryAnotherWay')}
              </button>
            </form>
          )}
        </section>

        {displayInfo && <div className="text-center text-sm text-muted-foreground">{infoNode}</div>}
      </main>

      {brand && (
        <footer className="mt-auto flex items-center gap-1.5 pt-12 text-xs text-muted-foreground">
          Sign-in by
          <TenantryMark className="size-3.5" />
          <a href="https://tenantry.pengopal.com" className={cn(linkClass, 'text-muted-foreground')}>
            Tenantry
          </a>
        </footer>
      )}
    </div>
  );
}
