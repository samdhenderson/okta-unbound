/**
 * @module shared/scheduler/runBatch
 * @description Concurrency-bounded batch runner for Okta API work.
 *
 * The single primitive every multi-call flow (reads and writes) should use. Given a
 * list of items and a `task` that performs the API call (through the rate-limited
 * scheduler), it runs at most `concurrency` at once and surfaces a live operation
 * view — `total / completed / active / failed` — after every state change, polls a
 * cancellation guard so "Cancel" stops launching new work (in-flight tasks are
 * allowed to settle), and can halt early on a fatal error (e.g. a 403 wall).
 *
 * It is deliberately pure and framework-free so it can be unit-tested directly;
 * `ProgressContext`/`useOktaApi` adapt it to React and the shared cancellation token.
 */

/** Live counts for an in-flight batch. `pending = total - completed - failed - active`. */
export interface BatchProgress {
  /** Total items in the batch. */
  total: number;
  /** Items that settled successfully. */
  completed: number;
  /** Items currently running. */
  active: number;
  /** Items that settled with an error. */
  failed: number;
}

/** Per-item outcome. `skipped` means never started (cancelled or halted). */
export interface BatchItemResult<T, R> {
  item: T;
  index: number;
  status: 'fulfilled' | 'rejected' | 'skipped';
  value?: R;
  error?: unknown;
}

/** Options for {@link runBatch}. */
export interface RunBatchOptions<T> {
  /** Max tasks in flight at once. Defaults to 5 (the scheduler's cap). */
  concurrency?: number;
  /** Throws (e.g. `OperationCancelledError`) to signal cancellation; polled before each start. */
  throwIfCancelled?: () => void;
  /** Called after every start/settle with the current counts. */
  onProgress?: (progress: BatchProgress) => void;
  /** Return `true` from a settled error to stop launching further work. */
  stopOnError?: (error: unknown, item: T, index: number) => boolean;
}

/** Aggregate result of a {@link runBatch} run. */
export interface BatchOutcome<T, R> {
  /** One entry per input item, in original order. */
  results: BatchItemResult<T, R>[];
  total: number;
  completed: number;
  failed: number;
  /** Items never started because of cancellation or an error halt. */
  skipped: number;
  /** True if `stopOnError` requested a halt. */
  stoppedByError: boolean;
  /** True if `throwIfCancelled` threw during the run. */
  cancelled: boolean;
}

/**
 * Run `task` over `items` with bounded concurrency, live progress, and cancellation.
 *
 * @typeParam T - Item type.
 * @typeParam R - Task result type.
 * @param items - Work items.
 * @param task - Per-item async worker; typically issues one scheduler request.
 * @param options - See {@link RunBatchOptions}.
 * @returns A {@link BatchOutcome}. Never throws for control flow — cancellation and
 * error halts are reported via `cancelled` / `stoppedByError` and `skipped` items,
 * so callers keep the partial results (e.g. to log what did succeed).
 */
export async function runBatch<T, R>(
  items: T[],
  task: (item: T, index: number) => Promise<R>,
  options: RunBatchOptions<T> = {},
): Promise<BatchOutcome<T, R>> {
  const { concurrency = 5, throwIfCancelled, onProgress, stopOnError } = options;
  const total = items.length;

  const results: BatchItemResult<T, R>[] = items.map((item, index) => ({
    item,
    index,
    status: 'skipped',
  }));

  let completed = 0;
  let failed = 0;
  let active = 0;
  let next = 0;
  let halted = false; // stopOnError requested a halt
  let cancelled = false;

  const report = () => onProgress?.({ total, completed, active, failed });

  const shouldStop = (): boolean => {
    if (halted) return true;
    if (throwIfCancelled) {
      try {
        throwIfCancelled();
      } catch {
        cancelled = true;
        return true;
      }
    }
    return false;
  };

  async function worker(): Promise<void> {
    for (;;) {
      if (shouldStop()) return;
      const index = next;
      if (index >= total) return;
      next += 1;

      const item = items[index];
      active += 1;
      report();

      try {
        const value = await task(item, index);
        results[index] = { item, index, status: 'fulfilled', value };
        completed += 1;
      } catch (error) {
        results[index] = { item, index, status: 'rejected', error };
        failed += 1;
        if (stopOnError?.(error, item, index)) {
          halted = true;
        }
      } finally {
        active -= 1;
        report();
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, total));
  report(); // initial 0/total snapshot
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const skipped = total - completed - failed;
  return { results, total, completed, failed, skipped, stoppedByError: halted, cancelled };
}
