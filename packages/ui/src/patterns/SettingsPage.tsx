import { Button, ButtonSet, InlineLoading } from '@carbon/react';
import type { ReactNode } from 'react';
import { PageHeader, type Crumb } from './PageHeader.js';

interface SettingsPageProps {
  breadcrumbs?: Crumb[];
  title: string;
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
  children,
  dirty,
  saving,
  onSave,
  onDiscard,
}: SettingsPageProps) {
  return (
    <div className="tenantry-page">
      <PageHeader breadcrumbs={breadcrumbs} title={title} />
      <div className="tenantry-page__body">{children}</div>
      <div className="tenantry-save-bar">
        <ButtonSet>
          <Button kind="secondary" disabled={!dirty || saving} onClick={onDiscard}>
            Discard
          </Button>
          {saving ? (
            <InlineLoading description="Saving" className="tenantry-save-bar__loading" />
          ) : (
            <Button kind="primary" disabled={!dirty} onClick={onSave}>
              Save
            </Button>
          )}
        </ButtonSet>
      </div>
    </div>
  );
}
