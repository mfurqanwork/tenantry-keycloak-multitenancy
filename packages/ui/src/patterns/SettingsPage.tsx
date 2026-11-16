import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../components/button.js';
import type { IconComponent } from '../icon.js';
import { Page } from './page.js';
import { PageHeader, type Crumb } from './PageHeader.js';

interface SettingsPageProps {
  breadcrumbs?: Crumb[];
  title: string;
  icon?: IconComponent;
  description?: ReactNode;
  children: ReactNode;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

// Grouped forms with one save bar at the bottom; Save stays disabled until something changed.
export function SettingsPage({
  breadcrumbs,
  title,
  icon,
  description,
  children,
  dirty,
  saving,
  onSave,
  onDiscard,
}: SettingsPageProps) {
  return (
    <Page>
      <PageHeader breadcrumbs={breadcrumbs} title={title} icon={icon} description={description} />
      <div className="flex flex-col gap-6">{children}</div>
      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button variant="secondary" disabled={!dirty || saving} onClick={onDiscard}>
          Discard
        </Button>
        <Button disabled={!dirty || saving} onClick={onSave}>
          {saving && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Page>
  );
}
