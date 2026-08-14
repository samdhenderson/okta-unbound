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

/** The signed-in admin the fake `getCurrentUser` resolves to. Fake placeholder. */
export const FAKE_ADMIN = { email: 'admin@example.com', id: 'admin' } as const;

/**
 * Overrides accepted by {@link makeFakeCore}.
 *
 * Every field is checked against the real `CoreApi` **except** `runOperation`.
 * That one is generic (`<T, R>(name, items: T[], task: (item: T, …) => Promise<R>)`),
 * and a `vi.fn()` executor written against `unknown` cannot satisfy it without
 * ceasing to be a usable fake. The suites this replaced dodged the problem with a
 * blanket `as unknown as CoreApi` on the whole literal; loosening the single field
 * that needs it keeps the other eight type-checked.
 */
export type FakeCoreOverrides = Partial<Omit<CoreApi, 'runOperation'>> & {
  runOperation?: unknown;
};

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
      task: (item: unknown, index: number) => Promise<unknown>,
    ) => {
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
          const value = await task(items[i], i);
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
