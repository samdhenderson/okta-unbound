/**
 * @module sidepanel/hooks/useRuleImpact.test
 * @description Behaviour of the rule-impact modal driver — chiefly the two
 * stale-capture guards that stop a capture started for one rule from clobbering
 * the state of a modal that has since been reopened for another rule (or closed),
 * plus the failure path that turns a rejected capture into a readable error.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRuleImpact } from './useRuleImpact';
import type { RuleImpactInput } from './useOktaApi/ruleImpact';
import type { RuleImpactSummary } from '../../shared/membership/ruleImpact';

/** A promise whose settlement is driven by the test, to hold a capture in flight. */
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const ruleA: RuleImpactInput = {
  id: '0prFAKERULEA',
  name: 'Contractors → Vendor Access',
  groupIds: ['00gFAKEGROUP1'],
  groupNames: ['Vendor Access'],
};

const ruleB: RuleImpactInput = {
  id: '0prFAKERULEB',
  name: 'Engineers → Build Tools',
  groupIds: ['00gFAKEGROUP2', '00gFAKEGROUP3'],
  groupNames: ['Build Tools', 'CI Admins'],
};

const summaryFor = (rule: RuleImpactInput): RuleImpactSummary => ({
  ruleId: rule.id,
  ruleName: rule.name,
  targetGroups: [],
  distinctMemberCount: 0,
  totalLosing: 0,
});

/**
 * A `captureRuleImpact` double that never settles on its own: each call parks a
 * deferred the test settles by hand, and records the `onProgress` callback that
 * call was handed so a stale progress report can be replayed later.
 */
const makeCapture = () => {
  const calls: {
    rule: RuleImpactInput;
    onProgress?: (current: number, total: number, message: string) => void;
    deferred: Deferred<RuleImpactSummary>;
  }[] = [];

  const captureRuleImpact = vi.fn(
    (
      rule: RuleImpactInput,
      opts?: { onProgress?: (current: number, total: number, message: string) => void },
    ) => {
      const d = deferred<RuleImpactSummary>();
      calls.push({ rule, onProgress: opts?.onProgress, deferred: d });
      return d.promise;
    },
  );

  return { captureRuleImpact, calls };
};

/**
 * Let the `.then`/`.catch` continuations of a settled capture run. A rejection
 * travels through the `.then` link before reaching `.catch`, so drain more than
 * one microtask tick.
 */
const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

describe('useRuleImpact', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The error path logs through the shared logger, which writes to console.error.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('starts idle with nothing to show', () => {
    const { captureRuleImpact } = makeCapture();
    const { result } = renderHook(() => useRuleImpact(captureRuleImpact));

    expect(result.current.rule).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(captureRuleImpact).not.toHaveBeenCalled();
  });

  it('opens into a loading state and reports the captured summary', async () => {
    const { captureRuleImpact, calls } = makeCapture();
    const { result } = renderHook(() => useRuleImpact(captureRuleImpact));

    act(() => result.current.open(ruleB, 'deactivate'));

    expect(result.current.rule).toEqual(ruleB);
    expect(result.current.mode).toBe('deactivate');
    expect(result.current.status).toBe('loading');
    expect(result.current.progress).toEqual({
      current: 0,
      total: 2,
      message: 'Starting analysis…',
    });

    act(() => calls[0].onProgress?.(1, 2, 'Loading members for Build Tools…'));
    expect(result.current.progress).toEqual({
      current: 1,
      total: 2,
      message: 'Loading members for Build Tools…',
    });

    calls[0].deferred.resolve(summaryFor(ruleB));
    await flush();

    expect(result.current.status).toBe('done');
    expect(result.current.summary?.ruleId).toBe(ruleB.id);
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
  });

  describe('stale-capture guards', () => {
    it('ignores a resolved capture belonging to a rule the modal has moved off', async () => {
      const { captureRuleImpact, calls } = makeCapture();
      const { result } = renderHook(() => useRuleImpact(captureRuleImpact));

      act(() => result.current.open(ruleA, 'preview'));
      // Reopened for another rule while rule A's capture is still in flight.
      act(() => result.current.open(ruleB, 'deactivate'));

      calls[0].deferred.resolve(summaryFor(ruleA));
      await flush();

      // Rule A's late answer must not land on rule B's modal.
      expect(result.current.summary).toBeNull();
      expect(result.current.status).toBe('loading');
      expect(result.current.rule).toEqual(ruleB);
      expect(result.current.progress).toEqual({
        current: 0,
        total: 2,
        message: 'Starting analysis…',
      });

      // …and the live capture still lands normally.
      calls[1].deferred.resolve(summaryFor(ruleB));
      await flush();

      expect(result.current.status).toBe('done');
      expect(result.current.summary?.ruleId).toBe(ruleB.id);
    });

    it('ignores a rejected capture belonging to a rule the modal has moved off', async () => {
      const { captureRuleImpact, calls } = makeCapture();
      const { result } = renderHook(() => useRuleImpact(captureRuleImpact));

      act(() => result.current.open(ruleA, 'preview'));
      act(() => result.current.open(ruleB, 'deactivate'));

      calls[0].deferred.reject(new Error('rule A capture failed'));
      await flush();

      // A failure that belongs to the previous rule must not surface as rule B's.
      expect(result.current.status).toBe('loading');
      expect(result.current.error).toBeNull();
      expect(result.current.rule).toEqual(ruleB);

      calls[1].deferred.resolve(summaryFor(ruleB));
      await flush();

      expect(result.current.status).toBe('done');
      expect(result.current.error).toBeNull();
      expect(result.current.summary?.ruleId).toBe(ruleB.id);
    });

    it('ignores progress reported by a capture the modal has moved off', () => {
      const { captureRuleImpact, calls } = makeCapture();
      const { result } = renderHook(() => useRuleImpact(captureRuleImpact));

      act(() => result.current.open(ruleA, 'preview'));
      act(() => result.current.open(ruleB, 'deactivate'));

      act(() => calls[0].onProgress?.(1, 1, 'Loading members for Vendor Access…'));

      expect(result.current.progress).toEqual({
        current: 0,
        total: 2,
        message: 'Starting analysis…',
      });

      // The live capture's progress still gets through.
      act(() => calls[1].onProgress?.(2, 2, 'Loading members for CI Admins…'));
      expect(result.current.progress).toEqual({
        current: 2,
        total: 2,
        message: 'Loading members for CI Admins…',
      });
    });

    it('ignores a capture that settles after the modal was closed', async () => {
      const { captureRuleImpact, calls } = makeCapture();
      const { result } = renderHook(() => useRuleImpact(captureRuleImpact));

      act(() => result.current.open(ruleA, 'preview'));
      act(() => result.current.close());

      expect(result.current.rule).toBeNull();
      expect(result.current.status).toBe('idle');

      calls[0].deferred.resolve(summaryFor(ruleA));
      await flush();

      expect(result.current.status).toBe('idle');
      expect(result.current.summary).toBeNull();
      expect(result.current.rule).toBeNull();
      expect(result.current.progress).toBeNull();
    });

    it('ignores a capture that fails after the modal was closed', async () => {
      const { captureRuleImpact, calls } = makeCapture();
      const { result } = renderHook(() => useRuleImpact(captureRuleImpact));

      act(() => result.current.open(ruleA, 'preview'));
      act(() => result.current.close());

      calls[0].deferred.reject(new Error('rule A capture failed'));
      await flush();

      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBeNull();
    });
  });

  describe('error path', () => {
    it("surfaces a failed capture's message and clears progress", async () => {
      const { captureRuleImpact, calls } = makeCapture();
      const { result } = renderHook(() => useRuleImpact(captureRuleImpact));

      act(() => result.current.open(ruleA, 'deactivate'));
      calls[0].deferred.reject(new Error('Failed to fetch group rules'));
      await flush();

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Failed to fetch group rules');
      expect(result.current.summary).toBeNull();
      expect(result.current.progress).toBeNull();
      // The rule stays put so the modal can keep naming what failed.
      expect(result.current.rule).toEqual(ruleA);
    });

    it('falls back to a generic message when the rejection is not an Error', async () => {
      const { captureRuleImpact, calls } = makeCapture();
      const { result } = renderHook(() => useRuleImpact(captureRuleImpact));

      act(() => result.current.open(ruleA, 'preview'));
      calls[0].deferred.reject('cancelled');
      await flush();

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Failed to analyze rule impact');
    });

    it('clears a previous error when reopened, and can succeed afterwards', async () => {
      const { captureRuleImpact, calls } = makeCapture();
      const { result } = renderHook(() => useRuleImpact(captureRuleImpact));

      act(() => result.current.open(ruleA, 'preview'));
      calls[0].deferred.reject(new Error('Failed to fetch group rules'));
      await flush();
      expect(result.current.status).toBe('error');

      act(() => result.current.open(ruleB, 'deactivate'));
      expect(result.current.error).toBeNull();
      expect(result.current.status).toBe('loading');

      calls[1].deferred.resolve(summaryFor(ruleB));
      await flush();
      expect(result.current.status).toBe('done');
      expect(result.current.error).toBeNull();
    });
  });

  it('close resets everything after a completed capture', async () => {
    const { captureRuleImpact, calls } = makeCapture();
    const { result } = renderHook(() => useRuleImpact(captureRuleImpact));

    act(() => result.current.open(ruleA, 'preview'));
    calls[0].deferred.resolve(summaryFor(ruleA));
    await flush();
    expect(result.current.summary?.ruleId).toBe(ruleA.id);

    act(() => result.current.close());

    expect(result.current.rule).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBeNull();
  });
});
