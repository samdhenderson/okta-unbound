/**
 * Tests for ProgressContext's cancellation surface.
 *
 * ProgressContext is the single owner of the "current operation" cancellation
 * token, so a global Cancel (the Activity Bar) and the operation loops
 * (`useOktaApi` → `checkCancelled`) share one signal. These pin that cancelling
 * trips the token, that starting/completing an operation resets it (so a stale
 * cancel never blocks the next operation), and that `isCancelling` reflects state
 * for the UI.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ProgressProvider, useProgress } from './ProgressContext';
import { OperationCancelledError } from '../../shared/scheduler/cancellation';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProgressProvider>{children}</ProgressProvider>
);

describe('ProgressContext cancellation', () => {
  it('starts un-cancelled', () => {
    const { result } = renderHook(() => useProgress(), { wrapper });
    expect(result.current.isCancelled).toBe(false);
    expect(() => result.current.throwIfCancelled()).not.toThrow();
    expect(result.current.progress.isCancelling).toBeFalsy();
  });

  it('cancel() trips the token and flags isCancelling', () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.startProgress('Bulk remove', 'Working…', 10);
    });
    act(() => {
      result.current.cancel();
    });

    expect(result.current.isCancelled).toBe(true);
    expect(() => result.current.throwIfCancelled()).toThrow(OperationCancelledError);
    expect(result.current.progress.isCancelling).toBe(true);
  });

  it('startProgress resets a prior cancel so the next operation runs', () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.cancel();
    });
    act(() => {
      result.current.startProgress('Next op', 'Working…', 5);
    });

    expect(result.current.isCancelled).toBe(false);
    expect(() => result.current.throwIfCancelled()).not.toThrow();
    expect(result.current.progress.isCancelling).toBe(false);
  });

  it('completeProgress resets the token', () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.cancel();
    });
    act(() => {
      result.current.completeProgress();
    });

    expect(result.current.isCancelled).toBe(false);
    expect(() => result.current.throwIfCancelled()).not.toThrow();
  });

  it('keeps throwIfCancelled identity stable across progress updates', () => {
    const { result } = renderHook(() => useProgress(), { wrapper });
    const first = result.current.throwIfCancelled;

    act(() => {
      result.current.startProgress('Op', 'Working…', 10);
    });
    act(() => {
      result.current.updateProgress(3, 10, 'more');
    });

    // Stable identity matters: useOktaApi threads this into a memoized coreApi.
    expect(result.current.throwIfCancelled).toBe(first);
  });
});

describe('ProgressContext operation model', () => {
  it('starts an operation with zeroed batch counts', () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => result.current.startProgress('Removing users', 'Working…', 30));

    expect(result.current.progress).toMatchObject({
      isLoading: true,
      total: 30,
      completed: 0,
      active: 0,
      failed: 0,
    });
  });

  it('updateBatch records completed / active / failed and rolls up to current', () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => result.current.startProgress('Removing users', 'Working…', 30));
    act(() =>
      result.current.updateBatch(
        { total: 30, completed: 12, active: 5, failed: 2 },
        'Removed 12 of 30',
      ),
    );

    expect(result.current.progress).toMatchObject({
      isLoading: true,
      total: 30,
      completed: 12,
      active: 5,
      failed: 2,
      current: 14, // completed + failed
      message: 'Removed 12 of 30',
    });
  });

  it('completeProgress clears the batch counts', () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => result.current.startProgress('Op', 'Working…', 30));
    act(() => result.current.updateBatch({ total: 30, completed: 30, active: 0, failed: 0 }));
    act(() => result.current.completeProgress());

    expect(result.current.progress).toMatchObject({
      isLoading: false,
      completed: 0,
      active: 0,
      failed: 0,
    });
  });
});
