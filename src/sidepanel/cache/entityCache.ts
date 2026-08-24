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

/**
 * Upper bound on retained entries.
 *
 * The store is a module-level `Map` that lives as long as the panel session, and
 * a session is measured in hours. Every visited group banks an `OktaUser[]` under
 * `groupMembers` plus a derived `memberSource` breakdown, so browsing a few
 * hundred groups holds tens of thousands of user objects with nothing releasing
 * them. TTL alone never did: expiry is a *freshness verdict* read at `peek` time,
 * not a deletion.
 *
 * 500 is well above any plausible working set (a session touching 500 distinct
 * entities is already unusual) and far below the point where retention hurts.
 */
export const MAX_ENTRIES = 500;

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
  /**
   * Epoch millis when this value was written — i.e. when it was actually fetched
   * from Okta, by whichever consumer fetched it.
   *
   * Surfaced because consumers were hand-rolling a parallel
   * `useState<string | null>` set to `new Date().toISOString()` on their own
   * successful loads. That answers a subtly different and worse question: "when
   * did *I* last fetch", not "when was this data fetched". On a cache hit the
   * hand-rolled value stays `null` while real data is on screen, so the UI reports
   * data it is displaying as never fetched.
   */
  fetchedAt: number;
}

interface StoredEntry<T> {
  data: T;
  /** Epoch millis when the entry was written. */
  timestamp: number;
  /** Epoch millis after which the entry is stale. */
  expiresAt: number;
  /** Epoch millis of the most recent read — the LRU signal for eviction. */
  lastRead: number;
}

// Module-level singletons — shared across every component in the panel session.
const store = new Map<string, StoredEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const subscribers = new Map<string, Set<() => void>>();

/**
 * Source key prefix → the derived prefixes computed from it.
 *
 * See {@link registerDerived}. Kept separate from the store so a registration
 * survives {@link resetEntityCache} — registrations are module wiring done at
 * import time, not session state.
 */
const derivedOf = new Map<string, Set<string>>();

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
  const now = Date.now();
  // Reads feed the LRU ordering used by eviction. A stale read still counts as
  // interest: stale-while-revalidate renders that value, so it is in use.
  entry.lastRead = now;
  return { data: entry.data, isFresh: now <= entry.expiresAt, fetchedAt: entry.timestamp };
}

/**
 * When a key's value was last written, or `null` if nothing is cached.
 *
 * Deliberately does **not** stamp `lastRead`: asking "how old is this?" is not
 * the same as using the value, and letting a metadata read defend an entry
 * against eviction would make a status line keep dead data alive.
 *
 * Returns the raw epoch so the cache holds no opinion on formatting.
 *
 * @param key - The entity key to inspect.
 * @returns Epoch millis of the write, or `null` on a miss.
 */
export function peekFetchedAt(key: EntityKey): number | null {
  return store.get(serializeKey(key))?.timestamp ?? null;
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
    lastRead: now,
  });
  log.debug('Set entry', { key: serialized });
  evictIfOverCapacity();
  notify(serialized);
}

/**
 * Drop entries until the store is back within {@link MAX_ENTRIES}.
 *
 * Two classes of entry are **never** evicted, because dropping them would cause
 * the refetch this cache exists to avoid:
 *
 * - **Subscribed keys.** A live subscriber means a mounted component is rendering
 *   that entry; evicting it fires the subscription and sends the component
 *   straight back to Okta. With up to nine tabs mounted at once (ADR-0018) that
 *   is the common case, not a corner one.
 * - **In-flight keys.** A fetch is already paying for that entry.
 *
 * Among the rest: expired entries go first (soonest-expired first), then the
 * least recently read. If every entry is protected the store is allowed to exceed
 * the bound — overshooting is strictly better than evicting data on screen.
 */
function evictIfOverCapacity(): void {
  if (store.size <= MAX_ENTRIES) return;

  const now = Date.now();
  const candidates: Array<{ serialized: string; expired: boolean; entry: StoredEntry<unknown> }> =
    [];
  for (const [serialized, entry] of store) {
    if (subscribers.has(serialized) || inFlight.has(serialized)) continue;
    candidates.push({ serialized, expired: now > entry.expiresAt, entry });
  }

  candidates.sort((a, b) => {
    if (a.expired !== b.expired) return a.expired ? -1 : 1;
    if (a.expired) return a.entry.expiresAt - b.entry.expiresAt;
    return a.entry.lastRead - b.entry.lastRead;
  });

  let evicted = 0;
  for (const { serialized } of candidates) {
    if (store.size <= MAX_ENTRIES) break;
    store.delete(serialized);
    evicted++;
  }

  if (evicted > 0) log.debug('Evicted entries', { count: evicted, size: store.size });
  if (store.size > MAX_ENTRIES) {
    log.debug('Over capacity with nothing evictable', { size: store.size });
  }
}

/**
 * Remove an entry and every entry nested beneath it, then notify affected
 * subscribers. Passing an exact key (`['groupMembers', id]`) drops just that
 * entry; passing a prefix (`['groupMembers']`) drops all group-member entries.
 *
 * @param key - The exact key or prefix to invalidate.
 */
export function invalidate(key: EntityKey): void {
  invalidateSerialized(serializeKey(key), new Set());
}

/**
 * Declare that one key family is **computed from** another, so invalidating the
 * source also drops the derived value.
 *
 * The motivating case is the member-source breakdown: `['memberSource', groupId]`
 * is summarised from `['groupMembers', groupId]`, and until now nothing dropped
 * it when the membership changed — `useGroupSource` carried a `KNOWN GAP` comment
 * saying the meter could show a pre-mutation count until the TTL lapsed. A
 * derived value outliving its source is a wrong answer on screen, not merely a
 * stale one.
 *
 * **Requires the scope tail to match.** The cascade rewrites only the leading
 * segment, so `['memberSource', X]` is dropped for `['groupMembers', X]`. Two
 * families keyed differently (one by group id, one by origin) cannot be related
 * this way.
 *
 * Registration is module wiring — call it at import time, once, next to the
 * derived cache itself. It deliberately survives {@link resetEntityCache}.
 *
 * @param derivedPrefix - Leading segment of the computed family, e.g. `memberSource`.
 * @param sourcePrefix - Leading segment it is computed from, e.g. `groupMembers`.
 */
export function registerDerived(derivedPrefix: string, sourcePrefix: string): void {
  let set = derivedOf.get(sourcePrefix);
  if (!set) {
    set = new Set();
    derivedOf.set(sourcePrefix, set);
  }
  set.add(derivedPrefix);
}

/**
 * Invalidate one serialized key plus everything nested beneath it, then cascade
 * to any registered derived families.
 *
 * @param target - The serialized key or prefix to drop.
 * @param seen - Guards against a registration cycle (A derived from B derived
 *   from A) recursing forever.
 */
function invalidateSerialized(target: string, seen: Set<string>): void {
  if (seen.has(target)) return;
  seen.add(target);

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

  // Cascade on the *requested* key, not only on what was present: the derived
  // entry can be cached while its source is not (the source expired, or the
  // caller is invalidating pre-emptively after a write).
  const [prefix, ...scope] = target.split(KEY_SEP);
  const derived = derivedOf.get(prefix);
  if (!derived) return;
  for (const derivedPrefix of derived) {
    invalidateSerialized([derivedPrefix, ...scope].join(KEY_SEP), seen);
  }
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
 *
 * {@link registerDerived} registrations are **not** cleared: they are import-time
 * module wiring, not session state, and a test that reset them would silently
 * stop exercising the cascade.
 */
export function resetEntityCache(): void {
  store.clear();
  inFlight.clear();
  subscribers.clear();
}
