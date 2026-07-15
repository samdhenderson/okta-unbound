/**
 * @module sidepanel/cache/useEntityQuery
 * @description React binding over {@link module:sidepanel/cache/entityCache}.
 *
 * A minimal, React-Query-shaped hook: given a cache key and a fetcher, it serves
 * a fresh cache hit synchronously (no loading flash, no refetch on remount),
 * revalidates stale data in the background, de-duplicates concurrent fetches, and
 * stays in sync with other consumers of the same key via the cache's pub/sub.
 *
 * This is what makes tab switches and entity re-navigation free: the data lives
 * in the module-level cache, so unmounting the component never discards it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getOrFetch,
  peek,
  peekEntry,
  serializeKey,
  subscribe,
  type EntityKey,
} from './entityCache';

/** Options for {@link useEntityQuery}. */
export interface UseEntityQueryOptions {
  /** Entry lifetime in milliseconds (default: cache default of 5 minutes). */
  ttl?: number;
  /** When `false`, no fetch is issued; cached data is still served. Defaults to `true`. */
  enabled?: boolean;
}

/** Result of {@link useEntityQuery}. */
export interface UseEntityQueryResult<T> {
  /** The cached/fetched value, or `null` before the first successful load. */
  data: T | null;
  /** `true` while a fetch is in flight with no data yet to show. */
  isLoading: boolean;
  /** Error message from the last failed fetch, or `null`. */
  error: string | null;
  /** `true` when showing cached data that has passed its TTL and is revalidating. */
  isStale: boolean;
  /** Force a fresh fetch, bypassing the cache and any in-flight de-dup. */
  refetch: () => Promise<void>;
}

/**
 * Cache-backed data fetching keyed by an {@link EntityKey}.
 *
 * On mount / key change: a fresh cache hit is served with no fetch; a stale hit is
 * shown immediately while a background revalidation runs; a miss triggers a fetch.
 * The `fetcher` may be an inline closure — it is read through a ref, so only the
 * key (and `enabled`/`ttl`) drive refetching.
 *
 * @typeParam T - The value type produced by `fetcher`.
 * @param key - Stable identity of the resource (e.g. `['groupMembers', groupId]`).
 * @param fetcher - Loads the value on a cache miss / revalidation.
 * @param options - See {@link UseEntityQueryOptions}.
 * @returns `{ data, isLoading, error, isStale, refetch }`.
 */
export function useEntityQuery<T>(
  key: EntityKey,
  fetcher: () => Promise<T>,
  options: UseEntityQueryOptions = {},
): UseEntityQueryResult<T> {
  const { ttl, enabled = true } = options;
  const serialized = serializeKey(key);

  // Read fetcher + key through refs so an inline fetcher / fresh array literal
  // doesn't re-run the effect — only the serialized key / enabled / ttl do.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const keyRef = useRef(key);
  keyRef.current = key;

  const [data, setData] = useState<T | null>(() => peek<T>(key));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  // Bumped by the cache subscription to re-run the load effect on external writes.
  const [revalidateTick, setRevalidateTick] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribe(keyRef.current, () => setRevalidateTick((t) => t + 1));
    return unsubscribe;
  }, [serialized]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const entry = peekEntry<T>(keyRef.current);
    if (entry?.isFresh) {
      // Fresh cache hit — serve synchronously, no fetch.
      setData(entry.data);
      setIsStale(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Stale-while-revalidate: show stale data (if any) and refetch; only show the
    // loading state when there is nothing cached to display.
    setData(entry ? entry.data : null);
    setIsStale(Boolean(entry));
    setIsLoading(!entry);
    setError(null);

    getOrFetch<T>(keyRef.current, () => fetcherRef.current(), { ttl })
      .then((fetched) => {
        if (cancelled) return;
        setData(fetched);
        setIsStale(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serialized, enabled, ttl, revalidateTick]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await getOrFetch<T>(keyRef.current, () => fetcherRef.current(), {
        ttl,
        force: true,
      });
      setData(fetched);
      setIsStale(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [ttl]);

  return { data, isLoading, error, isStale, refetch };
}
