import '@tenantry/ui/styles.scss';
import './login.scss';
import type { ClassKey } from 'keycloakify/login';
import DefaultPage from 'keycloakify/login/DefaultPage';
import { lazy, Suspense } from 'react';
import { useI18n } from './i18n.js';
import type { KcContext } from './KcContext.js';
import Template from './Template.js';

const UserProfileFormFields = lazy(() => import('keycloakify/login/UserProfileFormFields'));

// Keycloak's own page bodies (identity-first, password, register, verify email, …) keep every
// behaviour of the flow; our Template and Carbon's classes give them the Tenantry look.
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

const button = 'cds--btn';
const classes = {
  kcFormGroupClass: 'cds--form-item tenantry-login__group',
  kcLabelClass: 'cds--label',
  kcInputClass: 'cds--text-input',
  kcInputErrorMessageClass: 'cds--form-requirement tenantry-login__error',
  kcInputHelperTextBeforeClass: 'cds--form__helper-text',
  kcInputHelperTextAfterClass: 'cds--form__helper-text',
  kcButtonClass: button,
  kcButtonPrimaryClass: 'cds--btn--primary',
  kcButtonDefaultClass: 'cds--btn--secondary',
  kcButtonBlockClass: 'tenantry-login__block',
  kcButtonLargeClass: 'cds--btn--lg',
  kcFormButtonsClass: 'tenantry-login__actions',
  kcFormOptionsClass: 'tenantry-login__options',
  kcCheckboxInputClass: 'tenantry-login__checkbox',
  kcFormSocialAccountListClass: 'tenantry-login__providers',
  kcFormSocialAccountListButtonClass: `${button} cds--btn--tertiary tenantry-login__block`,
} satisfies Partial<Record<ClassKey, string>>;
