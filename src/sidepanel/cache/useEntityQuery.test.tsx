import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useEntityQuery } from './useEntityQuery';
import { resetEntityCache, setEntry, invalidate } from './entityCache';

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
});
