import { Button, ButtonSet, ProgressIndicator, ProgressStep } from '@carbon/react';
import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader.js';

interface WizardPageProps {
  title: string;
  steps: string[];
  currentStep: number;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}

// A multi-step flow (signup, app registration): progress, the step's content, then Back and Next.
export function WizardPage({
  title,
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
      <PageHeader title={title} />
      <ProgressIndicator currentIndex={currentStep} spaceEqually>
        {steps.map((step) => (
          <ProgressStep key={step} label={step} />
        ))}
      </ProgressIndicator>
      <div className="tenantry-page__body">{children}</div>
      <ButtonSet className="tenantry-wizard__actions">
        {onBack && (
          <Button kind="secondary" onClick={onBack}>
            Back
          </Button>
        )}
        <Button kind="primary" disabled={nextDisabled} onClick={onNext}>
          {nextLabel}
        </Button>
      </ButtonSet>
    </div>
  );
}
