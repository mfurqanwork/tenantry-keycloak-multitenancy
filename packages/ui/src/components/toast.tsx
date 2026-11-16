import { Toaster as Sonner, toast } from 'sonner';
import { useThemePreference } from '../theme/ThemeProvider.js';

export { toast };

/** Where toasts appear. Render once, inside TenantryThemeProvider. */
export function Toaster() {
  const { resolved } = useThemePreference();
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'rounded-lg border border-border bg-popover text-popover-foreground shadow-raised',
          description: 'text-muted-foreground',
        },
      }}
    />
  );
}
