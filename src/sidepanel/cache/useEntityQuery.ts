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
import { OperationCancelledError } from '../../shared/scheduler/cancellation';
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
  /**
   * When `false`, no fetch is issued. Cached data for the **current** key is
   * still served, and `data` still tracks the key — a key change while disabled
   * re-reads the cache rather than leaving the previous key's value in place.
   * Defaults to `true`.
   */
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
    let cancelled = false;

    // Resync to the CURRENT key before considering whether to fetch. This
    // ordering is the fix for a real defect: the effect used to return on
    // `!enabled` before touching state, and `data` is only ever seeded in the
    // `useState` initializer above. So a key change while disabled left the
    // PREVIOUS key's data in state — group A's members rendering under group B's
    // heading. Today's consumers gate on key validity rather than visibility, so
    // it was latent; it stops being latent the moment `enabled` is used as a
    // visibility gate.
    const entry = peekEntry<T>(keyRef.current);

    if (entry?.isFresh) {
      // Fresh cache hit — serve synchronously, no fetch. Correct whether or not
      // this query is enabled.
      setData(entry.data);
      setIsStale(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Stale-while-revalidate: show stale data (if any) and refetch; only show the
    // loading state when there is nothing cached to display. `error` clears here
    // because it described a fetch of a key we may no longer be asking about.
    setData(entry ? entry.data : null);
    setIsStale(Boolean(entry));
    setError(null);

    if (!enabled) {
      // No fetch — but state above is now consistent with the current key rather
      // than describing whatever key was last enabled.
      setIsLoading(false);
      return;
    }

    setIsLoading(!entry);

    getOrFetch<T>(keyRef.current, () => fetcherRef.current(), { ttl })
      .then((fetched) => {
        if (cancelled) return;
        setData(fetched);
        setIsStale(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Cancelling is a user decision, not a failure (ADR-0008). Surfacing it
        // as an error puts a red banner in front of someone who just pressed
        // Cancel. Whatever is already on screen stays.
        if (err instanceof OperationCancelledError) return;
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
      // Same carve-out as the load effect: a cancelled refresh is not an error.
      if (!(err instanceof OperationCancelledError)) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    } finally {
      setIsLoading(false);
    }
  }, [ttl]);

  return { data, isLoading, error, isStale, refetch };
}
