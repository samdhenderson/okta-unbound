/**
 * @module test/factories/coreApi
 * @description Fake {@link CoreApi} factory for the `useOktaApi/*` operation tests.
 *
 * `CoreApi` is the seam the module-per-concern layout exists for: every
 * `create*Operations` factory takes one and makes no other outbound call, so a
 * fake with `vi.fn()` members is the whole test harness
 * (`docs/testing.md` — mock at the layer under test, not the network).
 *
 * Eleven operation suites had hand-rolled the same nine-field object literal.
 * The **skeleton** lives here; the **defaults** do not travel, because each suite
 * relies on its own (`data: []` vs `data: {}`, an inert `runOperation` vs one that
 * really invokes the task). A suite whose defaults differ from the ones below
 * passes them through `overrides` rather than inheriting a value its assertions
 * were never written against.
 */
import { vi } from 'vitest';
import type { CoreApi } from '@/sidepanel/hooks/useOktaApi/core';

/**
 * The signed-in admin the fake `getCurrentUser` resolves to — a
 * `kind: 'resolved'` {@link Actor}. Fake placeholder values.
 */
export const FAKE_ADMIN = { kind: 'resolved', email: 'admin@example.com', id: 'admin' } as const;

/**
 * Overrides accepted by {@link makeFakeCore}.
 *
 * Every field is checked against the real `CoreApi` **except** the two generic
 * ones: `runOperation` (`<T, R>(name, items: T[], task: (item: T, …) => Promise<R>)`)
 * and `withPlan` (`<R>(name, legs, run: (handle) => Promise<R>)`). A `vi.fn()`
 * executor written against `unknown` cannot satisfy either without ceasing to be
 * a usable fake. The suites this replaced dodged the problem with a blanket
 * `as unknown as CoreApi` on the whole literal; loosening only the fields that
 * need it keeps the rest type-checked.
 */
export type FakeCoreOverrides = Partial<Omit<CoreApi, 'runOperation' | 'withPlan'>> & {
  runOperation?: unknown;
  withPlan?: unknown;
};

/**
 * A `withPlan` that runs its callback and does nothing else.
 *
 * The default, because the plan ledger is advisory (ADR-0060 §2): an operation's
 * observable behaviour must be identical whether or not a plan was declared, so
 * the fake that exercises that behaviour should add nothing. A suite asserting on
 * the *declaration* overrides this with its own spy.
 */
export function passThroughWithPlan() {
  return vi.fn(async (_name: string, _legs: unknown, run: (handle: unknown) => Promise<unknown>) =>
    run({ planId: 'fake-plan', refine: vi.fn() }),
  );
}

/**
 * Build a fake {@link CoreApi}.
 *
 * Defaults are the most common across the operation suites: a successful empty
 * list response, {@link FAKE_ADMIN}, and an **inert** `runOperation` that records
 * its call without invoking the task. Override any of them per suite or per case.
 *
 * @param overrides - Fields to replace on the returned fake.
 * @returns A `CoreApi` whose every method is a `vi.fn()` unless overridden.
 */
export function makeFakeCore(overrides: FakeCoreOverrides = {}): CoreApi {
  return {
    targetTabId: 1,
    sendMessage: vi.fn(),
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [], headers: {} }),
    getCurrentUser: vi.fn().mockResolvedValue({ ...FAKE_ADMIN }),
    checkCancelled: vi.fn(),
    resetCancellation: vi.fn(),
    runOperation: vi.fn(),
    withPlan: passThroughWithPlan(),
    callbacks: {},
    ...overrides,
  } as unknown as CoreApi;
}

/**
 * A `runOperation` that really executes each task in order, reporting one result
 * per item with its index and resolved value.
 *
 * Use it when the operation under test builds on `runOperation` and its inner
 * per-item logic is the thing being asserted; the inert default would skip that
 * logic entirely. Matches the batch-runner contract of ADR-0009 for the fields
 * these suites read — it does **not** implement cancellation or `stopOnError`.
 *
 * @returns A `vi.fn()` suitable for `makeFakeCore({ runOperation: … })`.
 */
export function sequentialRunOperation() {
  return vi.fn(
    async (
      _name: string,
      items: unknown[],
      task: (item: unknown, index: number, planId?: string) => Promise<unknown>,
      options?: { plan?: unknown },
    ) => {
      // The real runOperation only supplies a planId when a plan was declared,
      // so the fake mirrors that: a task asserting on `planId` sees `undefined`
      // exactly where production would.
      const planId = options?.plan ? 'fake-plan' : undefined;
      const results: Array<{
        item: unknown;
        index: number;
        status: string;
        value?: unknown;
        error?: unknown;
      }> = [];
      let completed = 0;
      let failed = 0;
      for (let i = 0; i < items.length; i++) {
        try {
          const value = await task(items[i], i, planId);
          results.push({ item: items[i], index: i, status: 'fulfilled', value });
          completed++;
        } catch (error) {
          results.push({ item: items[i], index: i, status: 'rejected', error });
          failed++;
        }
      }
      return {
        results,
        total: items.length,
        completed,
        failed,
        skipped: 0,
        stoppedByError: false,
        cancelled: false,
      };
    },
  );
}
