/**
 * Tests for useDebouncedValue — the generic trailing-edge value debouncer.
 *
 * Pins the contract the search hooks rely on: the initial value is available
 * immediately, updates surface only after the delay, every change restarts the
 * window, and the pending timer is cleaned up on unmount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderDebounced(initial: string, delayMs = 300) {
    return renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: initial, delay: delayMs },
    });
  }

  it('returns the initial value immediately', () => {
    const { result } = renderDebounced('first');
    expect(result.current).toBe('first');
  });

  it('emits an update only after the full delay', () => {
    const { result, rerender } = renderDebounced('first');

    rerender({ value: 'second', delay: 300 });
    expect(result.current).toBe('first');

    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('first');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('second');
  });

  it('restarts the window on every change, emitting only the latest value', () => {
    const { result, rerender } = renderDebounced('a');

    rerender({ value: 'ab', delay: 300 });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'abc', delay: 300 });
    act(() => vi.advanceTimersByTime(200));
    // 400ms of typing, but never 300ms of quiet.
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('abc');
  });

  it('cleans up the pending timer on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { rerender, unmount } = renderDebounced('first');

    rerender({ value: 'second', delay: 300 });
    unmount();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('works with non-string values', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
      initialProps: { value: { count: 1 } },
    });

    const next = { count: 2 };
    rerender({ value: next });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(next);
  });
});
