import type { ClassKey } from 'keycloakify/login';
import { buttonVariants, cn, fieldClass } from '@tenantry/ui';

// Keycloak's own page bodies (identity-first, password, register, verify email, …) keep every behaviour
// of the flow; these classes give their fields and buttons Tenantry's components' look.
export const classes = {
  kcFormGroupClass: 'flex flex-col gap-2',
  kcFormSettingClass: 'text-sm',
  kcLabelClass: 'text-sm font-medium text-foreground',
  kcInputClass: cn(fieldClass, 'h-10 py-1'),
  kcInputErrorMessageClass: 'text-sm text-destructive',
  kcInputHelperTextBeforeClass: 'text-sm text-muted-foreground',
  kcInputHelperTextAfterClass: 'text-sm text-muted-foreground',
  kcButtonClass: 'cursor-pointer',
  kcButtonPrimaryClass: cn(buttonVariants({ variant: 'primary' }), 'h-10'),
  kcButtonDefaultClass: cn(buttonVariants({ variant: 'outline' }), 'h-10'),
  kcButtonBlockClass: 'w-full',
  kcButtonLargeClass: '',
  kcFormButtonsClass: 'flex flex-col gap-2',
  kcFormOptionsClass: 'text-sm',
  kcFormOptionsWrapperClass: 'text-sm',
  kcCheckboxInputClass: 'size-4 accent-primary',
  kcFormClass: 'flex flex-col gap-4',
  kcInputGroup: 'relative flex items-center',
  kcFormPasswordVisibilityButtonClass: cn(
    buttonVariants({ variant: 'ghost', size: 'icon' }),
    'absolute right-0.5 size-9 text-muted-foreground hover:text-foreground',
  ),
  kcFormPasswordVisibilityIconShow: 'tenantry-eye',
  kcFormPasswordVisibilityIconHide: 'tenantry-eye-off',
} satisfies Partial<Record<ClassKey, string>>;
