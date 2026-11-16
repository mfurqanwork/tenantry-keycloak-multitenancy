import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KcPage } from './kc.gen.js';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

// Keycloak puts kcContext on window when it renders a page. `pnpm dev` has none, so it previews a page
// from Keycloakify's mock: ?page=login-password.ftl, ?providers=1 for a company sign-in button,
// ?user=<name> for the step that shows the typed username, and ?error=<text> for Keycloak's message.
async function context() {
  if (window.kcContext || !import.meta.env.DEV) return window.kcContext;
  const { getKcContextMock } = await import('./login/mock.js');
  const query = new URLSearchParams(window.location.search);
  const providers = query.has('providers')
    ? [{ alias: 'acme-corp', providerId: 'oidc', displayName: 'Acme Corp', loginUrl: '#', iconClasses: '' }]
    : [];
  return getKcContextMock({
    pageId: (query.get('page') ?? 'login-username.ftl') as 'login-username.ftl',
    overrides: {
      social: { displayInfo: true, providers },
      ...(query.get('user')
        ? { auth: { showUsername: true, showResetCredentials: false, attemptedUsername: query.get('user') ?? '' } }
        : {}),
      ...(query.get('error') ? { message: { type: 'error' as const, summary: query.get('error') ?? '' } } : {}),
    },
  });
}

void context().then((kcContext) => {
  createRoot(root).render(
    <StrictMode>{kcContext ? <KcPage kcContext={kcContext} /> : <h1>No Keycloak context</h1>}</StrictMode>,
  );
});
