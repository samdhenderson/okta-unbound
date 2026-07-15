/**
 * @module sidepanel/cache/entityCache
 * @description Session-scoped, in-memory entity cache with request de-duplication.
 *
 * A module-level singleton store — not tied to any React component — so cached
 * entity data (group members, user details, MFA scans, …) survives tab switches
 * and entity re-navigation within a panel session with **no** refetch. Three
 * concerns are handled here:
 *
 * - **Caching** — each entry carries a TTL; reads distinguish fresh from stale so
 *   consumers can serve stale data while revalidating.
 * - **De-duplication** — concurrent `getOrFetch` calls for the same key share one
 *   in-flight promise, so two components asking for the same resource hit Okta once.
 * - **Sync** — a tiny pub/sub notifies every subscriber on a key when its entry is
 *   written or invalidated, keeping multiple consumers of the same key consistent.
 *
 * Unlike {@link module:shared/rulesCache}, this cache is intentionally in-memory:
 * it targets unmount/remount churn within a session, not cross-session persistence.
 *
 * @see {@link module:sidepanel/cache/useEntityQuery}
 */

import { createLogger } from '../../shared/utils/logger';

const log = createLogger('EntityCache');

/** Default entry lifetime before it is considered stale. */
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/** Separator used to join composite key parts; `\u0000` cannot appear in ids. */
const KEY_SEP = '\u0000';

/**
 * A cache key: either a plain string or a composite tuple (e.g.
 * `['groupMembers', groupId]`). Composite keys enable prefix invalidation.
 */
export type EntityKey = string | ReadonlyArray<string | number>;

/** Options accepted when writing or fetching an entry. */
export interface EntityCacheOptions {
  /** Lifetime in milliseconds before the entry is stale (default: 5 minutes). */
  ttl?: number;
}

/** A cached value read back with its freshness verdict. */
export interface PeekedEntry<T> {
  /** The cached value. */
  data: T;
  /** `true` while the entry is within its TTL. */
  isFresh: boolean;
}

interface StoredEntry<T> {
  data: T;
  /** Epoch millis when the entry was written. */
  timestamp: number;
  /** Epoch millis after which the entry is stale. */
  expiresAt: number;
}

// Module-level singletons — shared across every component in the panel session.
const store = new Map<string, StoredEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const subscribers = new Map<string, Set<() => void>>();

/**
 * Serialize an {@link EntityKey} to its canonical string form. Composite keys are
 * joined with a control-character separator so that `['a', 'b']` and `['ab']`
 * never collide.
 *
 * @param key - The key to serialize.
 * @returns The stable string form used internally as the map key.
 */
export function serializeKey(key: EntityKey): string {
  return typeof key === 'string' ? key : key.map(String).join(KEY_SEP);
}

/** Notify every subscriber registered for a serialized key. */
function notify(serialized: string): void {
  const subs = subscribers.get(serialized);
  if (!subs) return;
  for (const cb of subs) cb();
}

/**
 * Read an entry along with its freshness, without fetching or evicting.
 *
 * @typeParam T - The stored value type.
 * @param key - The entity key to read.
 * @returns The value plus an `isFresh` flag, or `null` when nothing is cached.
 */
export function peekEntry<T>(key: EntityKey): PeekedEntry<T> | null {
  const entry = store.get(serializeKey(key)) as StoredEntry<T> | undefined;
  if (!entry) return null;
  return { data: entry.data, isFresh: Date.now() <= entry.expiresAt };
}

/**
 * Read a cached value only if it is still fresh.
 *
 * @typeParam T - The stored value type.
 * @param key - The entity key to read.
 * @returns The fresh value, or `null` on miss or expiry.
 */
export function peek<T>(key: EntityKey): T | null {
  const peeked = peekEntry<T>(key);
  return peeked && peeked.isFresh ? peeked.data : null;
}

/**
 * Write a value into the cache and notify subscribers.
 *
 * @typeParam T - The value type.
 * @param key - The entity key to write under.
 * @param data - The value to cache.
 * @param options - Optional TTL override (defaults to 5 minutes).
 */
export function setEntry<T>(key: EntityKey, data: T, options: EntityCacheOptions = {}): void {
  const serialized = serializeKey(key);
  const now = Date.now();
  store.set(serialized, {
    data,
    timestamp: now,
    expiresAt: now + (options.ttl ?? DEFAULT_TTL),
  });
  log.debug('Set entry', { key: serialized });
  notify(serialized);
}

/**
 * Remove an entry and every entry nested beneath it, then notify affected
 * subscribers. Passing an exact key (`['groupMembers', id]`) drops just that
 * entry; passing a prefix (`['groupMembers']`) drops all group-member entries.
 *
 * @param key - The exact key or prefix to invalidate.
 */
export function invalidate(key: EntityKey): void {
  const target = serializeKey(key);
  const childPrefix = target + KEY_SEP;
  const removed: string[] = [];
  for (const serialized of store.keys()) {
    if (serialized === target || serialized.startsWith(childPrefix)) {
      removed.push(serialized);
    }
  }
  for (const serialized of removed) {
    store.delete(serialized);
    inFlight.delete(serialized);
    notify(serialized);
  }
  if (removed.length) log.debug('Invalidated', { key: target, count: removed.length });
}

/** Run the fetcher, store the result, and clear the in-flight slot when settled. */
function fetchAndStore<T>(
  serialized: string,
  key: EntityKey,
  fetcher: () => Promise<T>,
  options: EntityCacheOptions,
): Promise<T> {
  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      setEntry(key, data, options);
      return data;
    })
    .finally(() => {
      // Only clear if we're still the current in-flight promise for this key.
      if (inFlight.get(serialized) === promise) inFlight.delete(serialized);
    });
  inFlight.set(serialized, promise);
  return promise;
}

/**
 * Return the cached value if fresh; otherwise fetch it — coalescing concurrent
 * requests for the same key onto a single in-flight promise. Rejections are not
 * cached, so a failed fetch can be retried immediately.
 *
 * @typeParam T - The value type produced by `fetcher`.
 * @param key - The entity key.
 * @param fetcher - Produces the value on a cache miss.
 * @param options - Optional TTL, plus `force` to bypass the cache and de-dup and
 *   start a fresh fetch (used by manual refresh).
 * @returns A promise for the value (resolved immediately on a fresh hit).
 */
export function getOrFetch<T>(
  key: EntityKey,
  fetcher: () => Promise<T>,
  options: EntityCacheOptions & { force?: boolean } = {},
): Promise<T> {
  const serialized = serializeKey(key);
  const { force, ...cacheOptions } = options;

  if (!force) {
    const fresh = peek<T>(key);
    if (fresh !== null) return Promise.resolve(fresh);

    const existing = inFlight.get(serialized) as Promise<T> | undefined;
    if (existing) return existing;
  }

  return fetchAndStore(serialized, key, fetcher, cacheOptions);
}

/**
 * Subscribe to writes/invalidations for a key.
 *
 * @param key - The entity key to watch.
 * @param callback - Invoked whenever the key's entry is set or invalidated.
 * @returns An unsubscribe function.
 */
export function subscribe(key: EntityKey, callback: () => void): () => void {
  const serialized = serializeKey(key);
  let subs = subscribers.get(serialized);
  if (!subs) {
    subs = new Set();
    subscribers.set(serialized, subs);
  }
  subs.add(callback);
  return () => {
    const set = subscribers.get(serialized);
    if (!set) return;
    set.delete(callback);
    if (set.size === 0) subscribers.delete(serialized);
  };
}

/**
 * Clear the entire cache (store, in-flight promises, and subscriber registry).
 * Intended for test isolation, not production use.
 */
export function resetEntityCache(): void {
  store.clear();
  inFlight.clear();
  subscribers.clear();
}
