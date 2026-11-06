import { Button, ProgressBar, Tile } from '@carbon/react';
import { CheckmarkFilled, type CarbonIconType } from '@carbon/icons-react';
import type { ReactNode } from 'react';

export interface SetupStep {
  label: string;
  done: boolean;
  // What to do next; shown only while the step is open.
  content: ReactNode;
}

// A short run of first steps with how far along they are; gone once every step is done.
export function SetupCard({
  title,
  icon: Icon,
  steps,
  onHide,
}: {
  title: string;
  icon?: CarbonIconType;
  steps: SetupStep[];
  onHide?: () => void;
}) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const percent = Math.round((done / steps.length) * 100);
  return (
    <section aria-label={title} className="tenantry-setup">
      <Tile>
        <div className="tenantry-setup__header">
          {Icon && <Icon size={20} aria-hidden="true" className="tenantry-setup__icon" />}
          <h2 className="tenantry-setup__title">{title}</h2>
          <span className="tenantry-setup__count">{`${done} of ${steps.length} done`}</span>
          {onHide && (
            <Button kind="ghost" size="sm" onClick={onHide}>
              Hide
            </Button>
          )}
        </div>
        <ProgressBar label={title} hideLabel value={percent} max={100} size="small" />
        <ol className="tenantry-setup__steps">
          {steps.map((step) => (
            <li key={step.label} className="tenantry-setup__step" data-done={step.done ? 'true' : 'false'}>
              {step.done ? (
                <p className="tenantry-setup__done">
                  <CheckmarkFilled aria-label="Done" className="tenantry-setup__check" />
                  {step.label}
                </p>
              ) : (
                step.content
              )}
            </li>
          ))}
        </ol>
      </Tile>
    </section>
  );
}
