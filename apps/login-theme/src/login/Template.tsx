import { InlineNotification, Link, Theme, Tile } from '@carbon/react';
import { kcSanitize } from 'keycloakify/lib/kcSanitize';
import { useInitialize } from 'keycloakify/login/Template.useInitialize';
import type { TemplateProps } from 'keycloakify/login/TemplateProps';
import { brandTokens } from '@tenantry/brand';
import { applyBrand } from '@tenantry/ui';
import { useEffect, useRef, useState } from 'react';
import type { I18n } from './i18n.js';
import type { KcContext } from './KcContext.js';
import { loadTenantBrand, tenantFromLocation, type TenantBrand } from './tenant-brand.js';

const KIND = { success: 'success', warning: 'warning', error: 'error', info: 'info' } as const;

// The frame around every Keycloak page: brand header, the page's title or the attempted username,
// Keycloak's message, the page body, "try another way", identity providers and the info area.
export default function Template(props: TemplateProps<KcContext, I18n>) {
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
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const tenant = tenantFromLocation(window.location.search, window.sessionStorage);
    if (!tenant) return;
    let current = true;
    void loadTenantBrand(tenant).then((found) => {
      if (current) setBrand(found);
    });
    return () => {
      current = false;
    };
  }, []);
  // Inside the g10 Theme, whose own tokens would otherwise win over the page body's.
  const color = brand?.primaryColor ?? null;
  useEffect(() => {
    if (main.current) applyBrand(color ? brandTokens(color) : null, main.current);
  });

  const { isReadyToRender } = useInitialize({ kcContext, doUseDefaultCss });
  if (!isReadyToRender) return null;

  const showMessage =
    displayMessage && message !== undefined && (message.type !== 'warning' || !isAppInitiatedAction);

  return (
    <Theme theme="g10" className="tenantry-login" data-tenantry-theme="">
      <main className="tenantry-login__main" ref={main}>
        <p className="tenantry-login__brand">
          {brand?.logoUrl && <img className="tenantry-login__logo" src={brand.logoUrl} alt={brand.name} />}
          <span className="tenantry-login__brand-name">{brand?.name ?? 'Tenantry'}</span>
        </p>
        <Tile className="tenantry-login__card">
          {auth?.showUsername && !auth.showResetCredentials ? (
            <div className="tenantry-login__username">
              <span>{auth.attemptedUsername}</span>
              <Link href={url.loginRestartFlowUrl}>{msg('restartLoginTooltip')}</Link>
            </div>
          ) : (
            <h1 className="tenantry-login__title">{headerNode}</h1>
          )}
          {showMessage && (
            <InlineNotification kind={KIND[message.type]} lowContrast hideCloseButton title="">
              <span dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }} />
            </InlineNotification>
          )}
          {children}
          {auth?.showTryAnotherWayLink && (
            <form id="kc-select-try-another-way-form" action={url.loginAction} method="post">
              <input type="hidden" name="tryAnotherWay" value="on" />
              <button type="submit" className="cds--btn cds--btn--ghost">
                {msg('doTryAnotherWay')}
              </button>
            </form>
          )}
          {socialProvidersNode}
          {displayInfo && <div className="tenantry-login__info">{infoNode}</div>}
        </Tile>
      </main>
    </Theme>
  );
}
