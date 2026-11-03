import { HeaderGlobalAction, HeaderPanel, Switcher, SwitcherItem } from '@carbon/react';
import type { CarbonIconType } from '@carbon/icons-react';

export interface SwitcherEntry {
  label: string;
  href: string;
  current: boolean;
}

interface HeaderSwitcherProps {
  label: string;
  Icon: CarbonIconType;
  entries: SwitcherEntry[];
  open: boolean;
  onToggle: () => void;
}

// A header button and its panel of links to other origins (full page loads; SSO signs the person in).
// With fewer than two entries there is nothing to switch to, so nothing renders.
export function HeaderSwitcherAction({
  label,
  Icon,
  entries,
  open,
  onToggle,
}: Omit<HeaderSwitcherProps, 'entries'> & { entries: SwitcherEntry[] }) {
  if (entries.length < 2) return null;
  return (
    <HeaderGlobalAction
      aria-label={label}
      aria-expanded={open}
      isActive={open}
      tooltipAlignment="end"
      onClick={onToggle}
    >
      <Icon size={20} />
    </HeaderGlobalAction>
  );
}

export function HeaderSwitcherPanel({
  label,
  entries,
  open,
}: Omit<HeaderSwitcherProps, 'Icon' | 'onToggle'>) {
  if (entries.length < 2) return null;
  return (
    <HeaderPanel aria-label={label} expanded={open}>
      <nav aria-label={label}>
        <Switcher aria-label={label} expanded={open}>
          {entries.map((entry) => (
            <SwitcherItem
              key={entry.href}
              href={entry.href}
              isSelected={entry.current}
              aria-label={entry.label}
              {...(entry.current ? { 'aria-current': 'page' as const } : {})}
            >
              {entry.label}
            </SwitcherItem>
          ))}
        </Switcher>
      </nav>
    </HeaderPanel>
  );
}
