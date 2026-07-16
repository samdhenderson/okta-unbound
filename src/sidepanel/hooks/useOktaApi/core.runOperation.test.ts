/**
 * Tests for coreApi.runOperation — the reusable wiring that turns any list of Okta
 * calls into a tracked, cancellable operation.
 *
 * It owns the global progress lifecycle (start → live batch counts → complete) and
 * routes work through {@link runBatch} with the shared cancellation guard, so every
 * operation that uses it gets the full "removing X · Y done · Z active" view and one
 * Cancel for free. These pin that contract without React.
 */
import { describe, it, expect, vi } from 'vitest';
import { createCoreApi } from './core';
import { OperationCancelledError } from '../../../shared/scheduler/cancellation';

/** Build a coreApi with spy progress hooks and a controllable cancel guard. */
function makeCore(checkCancelled: () => void = () => {}) {
  const progress = {
    start: vi.fn(),
    reportBatch: vi.fn(),
    complete: vi.fn(),
  };
  const core = createCoreApi(1, checkCancelled, vi.fn(), progress, {});
  return { core, progress };
}

describe('coreApi.runOperation', () => {
  it('starts, reports batch progress, and completes around the work', async () => {
    const { core, progress } = makeCore();

    const outcome = await core.runOperation('Removing users', [1, 2, 3], async (n) => n, {
      concurrency: 2,
    });

    expect(progress.start).toHaveBeenCalledWith('Removing users', 3);
    expect(progress.reportBatch).toHaveBeenCalled();
    expect(progress.complete).toHaveBeenCalledTimes(1);
    expect(outcome.completed).toBe(3);
    expect(outcome.results.map((r) => r.value)).toEqual([1, 2, 3]);
  });

  it('reports a final tally of total/completed/active/failed', async () => {
    const { core, progress } = makeCore();

    await core.runOperation('Op', [1, 2, 3, 4], async (n) => n, { concurrency: 2 });

    const lastCall = progress.reportBatch.mock.calls.at(-1)![0];
    expect(lastCall).toMatchObject({ total: 4, completed: 4, active: 0, failed: 0 });
  });

  it('completes even when cancelled, and marks the outcome cancelled', async () => {
    let n = 0;
    const { core, progress } = makeCore(() => {
      n += 1;
      if (n >= 2) throw new OperationCancelledError();
    });

    const outcome = await core.runOperation('Op', [1, 2, 3, 4, 5], async (x) => x, {
      concurrency: 1,
    });

    expect(outcome.cancelled).toBe(true);
    expect(outcome.skipped).toBeGreaterThan(0);
    expect(progress.complete).toHaveBeenCalledTimes(1);
  });
});
