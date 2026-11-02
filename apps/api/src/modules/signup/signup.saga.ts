export interface SagaStep {
  name: string;
  run(): Promise<void>;
  // Reverses run(). Steps whose effect a later undo already removes leave this out.
  undo?(): Promise<void>;
}

export class SagaFailedError extends Error {
  override name = 'SagaFailedError';
  constructor(
    readonly step: string,
    override readonly cause: unknown,
  ) {
    super(`signup step "${step}" failed`);
  }
}

// Runs steps in order. On a failure, undoes the completed steps in reverse and rethrows.
// A failing undo is reported and skipped, so one stuck cleanup cannot hide the others.
export async function runSaga(
  steps: SagaStep[],
  onUndoError: (step: string, err: unknown) => void,
): Promise<void> {
  const done: SagaStep[] = [];
  for (const step of steps) {
    try {
      await step.run();
      done.push(step);
    } catch (err) {
      for (const completed of done.reverse()) {
        try {
          await completed.undo?.();
        } catch (undoErr) {
          onUndoError(completed.name, undoErr);
        }
      }
      throw new SagaFailedError(step.name, err);
    }
  }
}
