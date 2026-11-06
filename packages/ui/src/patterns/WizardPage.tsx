import type { CarbonIconType } from '@carbon/icons-react';
import { Button, ProgressIndicator, ProgressStep } from '@carbon/react';
import type { ReactNode } from 'react';
import { PageHeader, type Crumb } from './PageHeader.js';

interface WizardPageProps {
  breadcrumbs?: Crumb[];
  title: string;
  icon?: CarbonIconType;
  description?: ReactNode;
  actions?: ReactNode;
  steps: string[];
  currentStep: number;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}

// A flow of one or more steps (signup, app registration): progress, the step's content, then Back and Next.
export function WizardPage({
  breadcrumbs,
  title,
  icon,
  description,
  actions,
  steps,
  currentStep,
  children,
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
}: WizardPageProps) {
  return (
    <div className="tenantry-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        icon={icon}
        description={description}
        actions={actions}
      />
      {/* One step is a plain form: no progress to show. */}
      {steps.length > 1 && (
        <div className="tenantry-wizard__progress">
          <ProgressIndicator currentIndex={currentStep} spaceEqually>
            {steps.map((step) => (
              <ProgressStep key={step} label={step} />
            ))}
          </ProgressIndicator>
        </div>
      )}
      <div className="tenantry-page__body">{children}</div>
      <div className="tenantry-wizard__actions">
        {onBack && (
          <Button kind="secondary" onClick={onBack}>
            Back
          </Button>
        )}
        <Button kind="primary" disabled={nextDisabled} onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
