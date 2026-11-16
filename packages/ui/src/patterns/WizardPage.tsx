import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../components/button.js';
import type { IconComponent } from '../icon.js';
import { cn } from '../lib/cn.js';
import { Page } from './page.js';
import { PageHeader, type Crumb } from './PageHeader.js';

interface WizardPageProps {
  breadcrumbs?: Crumb[];
  title: string;
  icon?: IconComponent;
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
    <Page className="max-w-3xl">
      <PageHeader breadcrumbs={breadcrumbs} title={title} icon={icon} description={description} actions={actions} />
      {/* One step is a plain form: no progress to show. */}
      {steps.length > 1 && (
        <ol aria-label="Progress" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {steps.map((step, index) => {
            const done = index < currentStep;
            const current = index === currentStep;
            return (
              <li
                key={step}
                aria-current={current ? 'step' : undefined}
                className={cn('flex items-center gap-2', current ? 'font-medium text-foreground' : 'text-muted-foreground')}
              >
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full border text-xs',
                    done && 'border-primary bg-primary text-primary-foreground',
                    current && 'border-primary text-foreground',
                    !done && !current && 'border-border',
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                {step}
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-col gap-6">{children}</div>
      <div className="flex justify-end gap-2">
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        )}
        <Button disabled={nextDisabled} onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    </Page>
  );
}
