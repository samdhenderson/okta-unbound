import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useEntityQuery } from './useEntityQuery';
import { resetEntityCache, setEntry, invalidate } from './entityCache';
import { OperationCancelledError } from '../../shared/scheduler/cancellation';

describe('useEntityQuery', () => {
  beforeEach(() => {
    resetEntityCache();
  });

  it('fetches on a miss and exposes the data', async () => {
    const fetcher = vi.fn().mockResolvedValue('value');
    const { result } = renderHook(() => useEntityQuery('k', fetcher));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe('value');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('serves a fresh cache hit synchronously without fetching (no remount refetch)', async () => {
    setEntry('k', 'cached');
    const fetcher = vi.fn().mockResolvedValue('fresh');
    const { result } = renderHook(() => useEntityQuery('k', fetcher));

    // Synchronous hit — data present on first render, never enters loading.
    expect(result.current.data).toBe('cached');
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => expect(fetcher).not.toHaveBeenCalled());
  });

  it('does not fetch when disabled, but still serves cache', async () => {
    setEntry('k', 'cached');
    const fetcher = vi.fn().mockResolvedValue('fresh');
    const { result } = renderHook(() => useEntityQuery('k', fetcher, { enabled: false }));

    expect(result.current.data).toBe('cached');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('two hooks on the same key share a single fetch (de-dup)', async () => {
    const fetcher = vi.fn().mockResolvedValue('shared');
    const a = renderHook(() => useEntityQuery('k', fetcher));
    const b = renderHook(() => useEntityQuery('k', fetcher));

    await waitFor(() => expect(a.result.current.data).toBe('shared'));
    await waitFor(() => expect(b.result.current.data).toBe('shared'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetch forces a fresh fetch past the cache', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const { result } = renderHook(() => useEntityQuery('k', fetcher));
    await waitFor(() => expect(result.current.data).toBe('first'));

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toBe('second');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('re-runs the fetch when the key is invalidated externally', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    const { result } = renderHook(() => useEntityQuery('k', fetcher));
    await waitFor(() => expect(result.current.data).toBe('v1'));

    act(() => invalidate('k'));
    await waitFor(() => expect(result.current.data).toBe('v2'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  describe('disabled queries track the key', () => {
    it('re-reads the cache when the key changes while disabled', async () => {
      // The regression this pins: the load effect used to `return` on `!enabled`
      // BEFORE touching state, and `data` is only seeded in the `useState`
      // initializer. So switching keys while disabled left the previous key's
      // value in state — group A's members under group B's heading.
      setEntry(['members', 'a'], ['ada']);
      setEntry(['members', 'b'], ['grace']);
      const fetcher = vi.fn();

      const { result, rerender } = renderHook(
        ({ id }) => useEntityQuery(['members', id], fetcher, { enabled: false }),
        { initialProps: { id: 'a' } },
      );

      expect(result.current.data).toEqual(['ada']);

      rerender({ id: 'b' });

      expect(result.current.data).toEqual(['grace']);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('clears data when the new key has nothing cached', async () => {
      setEntry(['members', 'a'], ['ada']);
      const fetcher = vi.fn();

      const { result, rerender } = renderHook(
        ({ id }) => useEntityQuery(['members', id], fetcher, { enabled: false }),
        { initialProps: { id: 'a' } },
      );
      expect(result.current.data).toEqual(['ada']);

      rerender({ id: 'uncached' });

      // Showing nothing is correct; showing the previous entity's members is not.
      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('still issues no fetch when enabled is false and the key is a miss', () => {
      const fetcher = vi.fn();
      renderHook(() => useEntityQuery('nothing-cached', fetcher, { enabled: false }));
      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  describe('cancellation is not an error', () => {
    it('leaves error null when the fetcher rejects with OperationCancelledError', async () => {
      const fetcher = vi.fn().mockRejectedValue(new OperationCancelledError());
      const { result } = renderHook(() => useEntityQuery('cancelled-key', fetcher));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      // A user pressing Cancel must not be shown a failure banner (ADR-0008).
      expect(result.current.error).toBeNull();
    });

    it('still surfaces a genuine failure', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('Okta said no'));
      const { result } = renderHook(() => useEntityQuery('failing-key', fetcher));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBe('Okta said no');
    });

    it('leaves error null when a manual refetch is cancelled', async () => {
      setEntry('refetch-key', 'cached');
      const fetcher = vi.fn().mockRejectedValue(new OperationCancelledError());
      const { result } = renderHook(() => useEntityQuery('refetch-key', fetcher));

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.data).toBe('cached');
    });
  });
});
