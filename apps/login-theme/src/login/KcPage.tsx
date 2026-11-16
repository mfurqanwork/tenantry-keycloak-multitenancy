import './login.css';
import DefaultPage from 'keycloakify/login/DefaultPage';
import { lazy, Suspense } from 'react';
import { useI18n } from './i18n.js';
import { classes } from './classes.js';
import type { KcContext } from './KcContext.js';
import Template from './Template.js';

const UserProfileFormFields = lazy(() => import('keycloakify/login/UserProfileFormFields'));

// Keycloak's own page bodies inside the Tenantry frame (Template) and components' classes (classes.ts).
export default function KcPage({ kcContext }: { kcContext: KcContext }) {
  const { i18n } = useI18n({ kcContext });
  return (
    <Suspense>
      <DefaultPage
        kcContext={kcContext}
        i18n={i18n}
        classes={classes}
        Template={Template}
        doUseDefaultCss={false}
        UserProfileFormFields={UserProfileFormFields}
        doMakeUserConfirmPassword={true}
      />
    </Suspense>
  );
}
