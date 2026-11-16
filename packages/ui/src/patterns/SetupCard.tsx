import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../components/button.js';
import type { IconComponent } from '../icon.js';

export interface SetupStep {
  label: string;
  done: boolean;
  // The step's icon, beside its content while it is open.
  icon?: IconComponent;
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
  icon?: IconComponent;
  steps: SetupStep[];
  onHide?: () => void;
}) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const percent = Math.round((done / steps.length) * 100);
  const progress = `${String(done)} of ${String(steps.length)} done`;
  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon size={18} aria-hidden="true" className="text-muted-foreground" />}
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">{progress}</span>
        {onHide && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onHide}>
            Hide
          </Button>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        aria-valuetext={progress}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${String(percent)}%` }} />
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((step) => (
          <li key={step.label} data-done={step.done ? 'true' : 'false'} className="text-sm">
            {step.done ? (
              <p className="flex items-center gap-2 text-muted-foreground line-through decoration-muted-foreground/50">
                <CircleCheck className="size-4 text-success" aria-label="Done" />
                {step.label}
              </p>
            ) : step.icon ? (
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-foreground">
                  <step.icon size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">{step.content}</div>
              </div>
            ) : (
              step.content
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
