/**
 * Tests for runBatch — the shared concurrency-bounded batch runner.
 *
 * Every multi-call Okta flow (reads and writes) runs through this so it gets the
 * same three properties for free: bounded concurrency (rate-limit-safe, because
 * each task still routes through the scheduler), a live operation view
 * (total / completed / active / failed), and cancellation that stops launching new
 * work while letting in-flight tasks settle. These tests pin that contract.
 */
import { describe, it, expect, vi } from 'vitest';
import { runBatch } from './runBatch';
import { createCancellation } from './cancellation';

/** A promise plus its resolver, for deterministically controlling task timing. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('runBatch', () => {
  it('runs every item and returns results in original order', async () => {
    const outcome = await runBatch([1, 2, 3, 4], async (n) => n * 10, { concurrency: 2 });

    expect(outcome.total).toBe(4);
    expect(outcome.completed).toBe(4);
    expect(outcome.failed).toBe(0);
    expect(outcome.results.map((r) => r.value)).toEqual([10, 20, 30, 40]);
    expect(outcome.results.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('never exceeds the concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    const gates = [deferred<void>(), deferred<void>(), deferred<void>(), deferred<void>()];

    const task = vi.fn(async (i: number) => {
      active += 1;
      peak = Math.max(peak, active);
      await gates[i].promise;
      active -= 1;
    });

    const run = runBatch([0, 1, 2, 3], task, { concurrency: 2 });
    // Let the pool start the first window.
    await Promise.resolve();
    await Promise.resolve();
    expect(active).toBe(2);

    gates.forEach((g) => g.resolve());
    await run;
    expect(peak).toBe(2);
  });

  it('reports live progress with active peaking at the concurrency limit', async () => {
    const progress: Array<{ completed: number; active: number; failed: number; total: number }> =
      [];
    await runBatch([1, 2, 3, 4, 5], async (n) => n, {
      concurrency: 2,
      onProgress: (p) => progress.push({ ...p }),
    });

    expect(progress.length).toBeGreaterThan(0);
    const last = progress[progress.length - 1];
    expect(last).toMatchObject({ total: 5, completed: 5, active: 0, failed: 0 });
    expect(Math.max(...progress.map((p) => p.active))).toBeLessThanOrEqual(2);
  });

  it('captures a failing task and keeps going', async () => {
    const outcome = await runBatch(
      ['ok1', 'boom', 'ok2'],
      async (s) => {
        if (s === 'boom') throw new Error('nope');
        return s.toUpperCase();
      },
      { concurrency: 3 },
    );

    expect(outcome.completed).toBe(2);
    expect(outcome.failed).toBe(1);
    expect(outcome.results[1].status).toBe('rejected');
    expect(outcome.results[0].value).toBe('OK1');
    expect(outcome.results[2].value).toBe('OK2');
  });

  it('stops launching new work when cancelled, leaving the rest skipped', async () => {
    const token = createCancellation();
    const seen: number[] = [];

    const outcome = await runBatch(
      [0, 1, 2, 3, 4, 5],
      async (n) => {
        seen.push(n);
        // Cancel partway through the first window.
        if (n === 1) token.cancel();
        return n;
      },
      { concurrency: 2, throwIfCancelled: () => token.throwIfCancelled() },
    );

    expect(outcome.cancelled).toBe(true);
    expect(outcome.skipped).toBeGreaterThan(0);
    // The last items were never started.
    expect(seen).not.toContain(5);
    expect(outcome.completed + outcome.failed + outcome.skipped).toBe(6);
  });

  it('halts starting new work when stopOnError requests it', async () => {
    const started: string[] = [];

    const outcome = await runBatch(
      ['a', 'b', 'c', 'd'],
      async (s) => {
        started.push(s);
        if (s === 'a') throw { status: 403, message: 'forbidden' };
        return s;
      },
      {
        concurrency: 1, // deterministic order
        stopOnError: (err) => (err as { status?: number }).status === 403,
      },
    );

    expect(outcome.stoppedByError).toBe(true);
    expect(outcome.failed).toBe(1);
    // With concurrency 1, only 'a' ran before the halt.
    expect(started).toEqual(['a']);
    expect(outcome.skipped).toBe(3);
  });
});
