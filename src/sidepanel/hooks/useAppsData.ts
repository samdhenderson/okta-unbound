/**
 * @module sidepanel/hooks/useAppsData
 * @description Loads the org's application inventory for the read-only Applications tab.
 *
 * Owns the app list, the loading flag and the last-fetch timestamp, and exposes a
 * single `loadApps` trigger. A fatal `getAllApps` failure is reported through a
 * caller-supplied `onError` so the tab shell decides how to surface it (a dismissible
 * danger banner).
 *
 * Caching is delegated to the session-scoped
 * {@link module:sidepanel/cache/entityCache}, mirroring
 * {@link module:sidepanel/hooks/usePoliciesData}: the inventory is a whole-org
 * paginated read, so switching away from the tab and back — or re-targeting the panel
 * at another Chrome tab on the same org — repaints from cache instead of re-walking
 * every page of `/api/v1/apps`. Concurrent loads coalesce onto one request, and
 * `force` bypasses both the cache and that de-duplication (the header's Refresh).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getOrFetch, peek, peekFetchedAt, type EntityKey } from '../cache/entityCache';
import { cacheKeys } from '../cache/keys';
import { useOwedLoad } from './useOwedLoad';
import type { OktaAppListItem } from '../../shared/schemas/okta';
import { createLogger } from '../../shared/utils/logger';
import type { useOktaApi } from './useOktaApi';

const log = createLogger('useAppsData');

type OktaApi = ReturnType<typeof useOktaApi>;

/**
 * Entity-cache key holding one org's application inventory.
 *
 * Scoped by **org origin**, not by `targetTabId`: a second Chrome tab pointed at the
 * same org should hit the cache, while a genuinely different org must never read
 * another org's inventory. `null`/`undefined` collapses to a single `'unknown'`
 * bucket, which is only reachable before the origin has been resolved.
 *
 * @param oktaOrigin - The connected org's origin (e.g. `https://example.okta.com`).
 * @returns The composite key for that org's inventory.
 */
export function appsCacheKey(oktaOrigin?: string | null): EntityKey {
  return cacheKeys.apps(oktaOrigin);
}

/**
 * The cache's own write time for a key, as an ISO string.
 *
 * Reads through {@link peekFetchedAt} rather than stamping `new Date()` at the
 * call site: a "last updated" line should report when the data was fetched, which
 * for an origin-scoped key may have been by a different Chrome tab's panel session
 * sharing the same entry.
 */
function isoFetchedAt(key: EntityKey): string | null {
  const at = peekFetchedAt(key);
  return at === null ? null : new Date(at).toISOString();
}

/** Options for {@link useAppsData}. */
export interface UseAppsDataOptions {
  /** The Okta API surface used to fetch the inventory. */
  api: Pick<OktaApi, 'getAllApps'>;
  /**
   * Surface a fatal load failure (`''` clears it). MUST be stable
   * (`useCallback`) — it is a dependency of the memoized `loadApps`.
   */
  onError: (message: string) => void;
  /** Connected Okta tab id; the auto-load is skipped while it is null. */
  targetTabId: number | null;
  /**
   * Connected org origin, used to scope the cache entry. Two Chrome tabs on the same
   * org share one cached inventory; a different org gets its own.
   */
  oktaOrigin?: string | null;
  /**
   * Whether the Applications tab is the visible one. The tab stays mounted while
   * hidden, and the auto-load re-arms on every new `targetTabId` — so without this
   * gate, switching Okta tabs would silently re-page the whole app inventory from a
   * tab nobody is looking at. Deferred, not dropped: the load runs on the next time
   * the tab is shown. Defaults to `true`.
   */
  enabled?: boolean;
}

/** Return shape of {@link useAppsData}. */
export interface UseAppsDataReturn {
  /** Every app in the org, as last loaded. */
  apps: OktaAppListItem[];
  /** Whether a load is in flight. */
  isLoading: boolean;
  /** ISO timestamp of the last successful load, or `null`. */
  lastFetchTime: string | null;
  /** Load the inventory; `force` bypasses the cache (manual refresh). */
  loadApps: (force?: boolean) => Promise<void>;
}

/**
 * Manage the Applications tab's data: the inventory, the loading flag, the
 * last-fetch timestamp, and the `loadApps` pipeline.
 *
 * The inventory loads once automatically when a tab is connected **and the
 * Applications tab is visible** (a single paginated read of `/api/v1/apps`); the
 * tab's Refresh action re-runs it.
 * `getAllApps` throws on a failed page — deliberately, so a truncated inventory is
 * never rendered as complete — so a failure clears nothing and reports the message
 * via `onError` instead.
 *
 * @param options - See {@link UseAppsDataOptions}.
 * @returns `{ apps, isLoading, lastFetchTime, loadApps }`.
 */
export function useAppsData({
  api,
  onError,
  targetTabId,
  oktaOrigin,
  enabled = true,
}: UseAppsDataOptions): UseAppsDataReturn {
  const cacheKey = useMemo(() => appsCacheKey(oktaOrigin), [oktaOrigin]);

  // Seed from the session cache so returning to the tab paints instantly, the same
  // way `usePoliciesData` does.
  const [apps, setApps] = useState<OktaAppListItem[]>(
    () => peek<OktaAppListItem[]>(cacheKey) ?? [],
  );
  const [isLoading, setIsLoading] = useState(false);
  // Seeded from the cache, like `apps` above. It used to start `null` regardless,
  // so a cache hit painted a real inventory under "never fetched".
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(() => isoFetchedAt(cacheKey));

  // Read `getAllApps` through a ref so `loadApps` keeps a stable identity even if
  // the API facade's memoization is defeated by an unstable caller callback.
  const getAllAppsRef = useRef(api.getAllApps);
  getAllAppsRef.current = api.getAllApps;

  const loadApps = useCallback(
    async (force: boolean = false) => {
      if (targetTabId == null) {
        onError('No Okta tab connected');
        return;
      }

      setIsLoading(true);
      onError('');

      try {
        const loaded = await getOrFetch<OktaAppListItem[]>(
          cacheKey,
          () => getAllAppsRef.current(),
          { force },
        );
        setApps(loaded);
        setLastFetchTime(isoFetchedAt(cacheKey));
        // Identifiers and outcomes only — never app labels or response bodies.
        log.debug('Loaded applications', { count: loaded.length });
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to load applications');
        log.error('Failed to load applications', { code: 'load_apps_failed' });
      } finally {
        setIsLoading(false);
      }
    },
    [onError, targetTabId, cacheKey],
  );

  // Drop the previous org's inventory the moment the org changes: it must not linger
  // on screen under the new org's identity, rendering one org's app names beside
  // another org's deep links until the fetch resolves. The new org may already be
  // cached, so re-seed rather than blanking.
  const seededFor = useRef(cacheKey);
  useEffect(() => {
    if (seededFor.current === cacheKey) return;
    seededFor.current = cacheKey;
    setApps(peek<OktaAppListItem[]>(cacheKey) ?? []);
    // Re-seed from the NEW key rather than blanking. Blanking was wrong whenever
    // the new org was already cached: the re-seeded inventory appeared with no
    // fetch time beside it.
    setLastFetchTime(isoFetchedAt(cacheKey));
  }, [cacheKey]);

  // Auto-load once per connected *target*, and only while the Applications tab is the
  // visible one. Guarded by a ref (not an `apps.length` check) so an org with
  // genuinely zero apps does not re-fetch on every render.
  //
  // The target is the `(tab id, origin)` pair, not the tab id alone: navigating a
  // single Chrome tab from one org to another changes the origin while the id stays
  // put, and a tab-id-only guard would never re-arm — leaving the panel showing the
  // previous org's inventory indefinitely. Re-arming is cheap now: a same-org
  // re-target is served from the cache without touching the network.
  // The latch identity is the (tab, origin) pair, NOT the cache key — which is
  // `origin` alone, deliberately, so two Chrome tabs on one org share an inventory.
  // That mismatch is why this is a standalone latch rather than a `useEntityQuery`
  // option (ADR-0026).
  //
  // `\u0000` as an escape, never a literal NUL: a raw control byte in source makes
  // this file binary to grep(1) and every tool built on it, and is invisible in
  // editors and diffs. Same runtime string either way.
  useOwedLoad(
    targetTabId == null ? null : `${targetTabId}\u0000${oktaOrigin ?? ''}`,
    enabled,
    () => {
      void loadApps();
    },
  );

  return { apps, isLoading, lastFetchTime, loadApps };
}
