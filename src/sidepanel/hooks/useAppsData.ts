/**
 * @module sidepanel/hooks/useAppsData
 * @description Loads the org's application inventory for the read-only Applications tab.
 *
 * Owns the app list, the loading flag and the last-fetch timestamp, and exposes a
 * single `loadApps` trigger. Follows the `useGroupsLoader` precedent for a
 * whole-org list: the list lives in hook state (not the entity cache), and a fatal
 * `getAllApps` failure is reported through a caller-supplied `onError` so the tab
 * shell decides how to surface it (a dismissible danger banner).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OktaAppListItem } from '../../shared/schemas/okta';
import { createLogger } from '../../shared/utils/logger';
import type { useOktaApi } from './useOktaApi';

const log = createLogger('useAppsData');

type OktaApi = ReturnType<typeof useOktaApi>;

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
}

/** Return shape of {@link useAppsData}. */
export interface UseAppsDataReturn {
  /** Every app in the org, as last loaded. */
  apps: OktaAppListItem[];
  /** Whether a load is in flight. */
  isLoading: boolean;
  /** ISO timestamp of the last successful load, or `null`. */
  lastFetchTime: string | null;
  /** Load (or reload) the inventory. `force` is accepted for call-site symmetry. */
  loadApps: (force?: boolean) => Promise<void>;
}

/**
 * Manage the Applications tab's data: the inventory, the loading flag, the
 * last-fetch timestamp, and the `loadApps` pipeline.
 *
 * The inventory loads once automatically when a tab is connected (a single
 * paginated read of `/api/v1/apps`); the tab's Refresh action re-runs it.
 * `getAllApps` throws on a failed page — deliberately, so a truncated inventory is
 * never rendered as complete — so a failure clears nothing and reports the message
 * via `onError` instead.
 *
 * @param options - See {@link UseAppsDataOptions}.
 * @returns `{ apps, isLoading, lastFetchTime, loadApps }`.
 */
export function useAppsData({ api, onError, targetTabId }: UseAppsDataOptions): UseAppsDataReturn {
  const [apps, setApps] = useState<OktaAppListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);

  // Read `getAllApps` through a ref so `loadApps` keeps a stable identity even if
  // the API facade's memoization is defeated by an unstable caller callback.
  const getAllAppsRef = useRef(api.getAllApps);
  getAllAppsRef.current = api.getAllApps;

  const loadApps = useCallback(async () => {
    if (targetTabId == null) {
      onError('No Okta tab connected');
      return;
    }

    setIsLoading(true);
    onError('');

    try {
      const loaded = await getAllAppsRef.current();
      setApps(loaded);
      setLastFetchTime(new Date().toISOString());
      // Identifiers and outcomes only — never app labels or response bodies.
      log.debug('Loaded applications', { count: loaded.length });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load applications');
      log.error('Failed to load applications', { code: 'load_apps_failed' });
    } finally {
      setIsLoading(false);
    }
  }, [onError, targetTabId]);

  // Auto-load once per connected tab. Guarded by a ref (not a `apps.length` check)
  // so an org with genuinely zero apps does not re-fetch on every render.
  const autoLoadedFor = useRef<number | null>(null);
  useEffect(() => {
    if (targetTabId == null || autoLoadedFor.current === targetTabId) return;
    autoLoadedFor.current = targetTabId;
    void loadApps();
  }, [targetTabId, loadApps]);

  return { apps, isLoading, lastFetchTime, loadApps };
}
