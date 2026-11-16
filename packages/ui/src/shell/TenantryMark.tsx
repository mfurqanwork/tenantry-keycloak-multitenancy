import logoDark from '../../assets/brand/tenantry-logo-dark.svg';
import logoLight from '../../assets/brand/tenantry-logo.svg';
import markDark from '../../assets/brand/tenantry-mark-dark.svg';
import markLight from '../../assets/brand/tenantry-mark.svg';
import { cn } from '../lib/cn.js';
import { useThemePreference } from '../theme/ThemeProvider.js';

const ART = {
  mark: { light: markLight, dark: markDark },
  logo: { light: logoLight, dark: logoDark },
} as const;

// Tenantry's own mark (or the mark with its wordmark), drawn for the page's light or dark theme.
// Decorative: the name always sits next to it in text.
export function TenantryMark({ variant = 'mark', className }: { variant?: 'mark' | 'logo'; className?: string }) {
  const { resolved } = useThemePreference();
  return (
    <img
      data-slot="tenantry-mark"
      data-variant={variant}
      data-theme={resolved}
      src={ART[variant][resolved]}
      alt=""
      className={cn(variant === 'mark' ? 'size-7' : 'h-7 w-auto', 'shrink-0', className)}
    />
  );
}
