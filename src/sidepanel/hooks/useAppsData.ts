/**
 * @module sidepanel/hooks/useAppsData
 * @description Supplies the read-only Applications tab from the background-owned
 * org snapshot (ADR-0040).
 *
 * Owns the loading flag and the last-fetch timestamp, and exposes a single
 * `loadApps` trigger. A fatal sync failure is reported through a caller-supplied
 * `onError` so the tab shell decides how to surface it (a dismissible danger
 * banner).
 *
 * Before ADR-0040 this hook paged `/api/v1/apps` itself and cached the result in
 * the session-scoped {@link module:sidepanel/cache/entityCache}. Two things
 * changed by moving it to the snapshot, and both are the point:
 *
 * - **The cache outlives the panel.** `entityCache` is in-memory and
 *   panel-owned, so closing the side panel threw the inventory away and the next
 *   open re-walked every page. The snapshot is on disk, so a returning visit
 *   paints before a request is issued.
 * - **Apps are fresh at the same moment groups and rules are.** The Overview's
 *   questions are joins across the three ("which app-sourced groups point at a
 *   deleted app?"), and a join is only trustworthy when both sides were walked
 *   by the same sync.
 *
 * The tab's own behaviour is unchanged: it still auto-loads once per connected
 * target while visible, and Refresh still forces a full walk.
 */

import { useCallback } from 'react';
import { useOwedLoad } from './useOwedLoad';
import { useOrgSnapshot } from '../cache/useOrgSnapshot';
import type { OktaAppListItem } from '../../shared/schemas/okta';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useAppsData');

/** Options for {@link useAppsData}. */
export interface UseAppsDataOptions {
  /**
   * Surface a fatal load failure (`''` clears it). MUST be stable
   * (`useCallback`) — it is a dependency of the memoized `loadApps`.
   */
  onError: (message: string) => void;
  /** Connected Okta tab id; the auto-load is skipped while it is null. */
  targetTabId: number | null;
  /**
   * Connected org origin — what the snapshot is scoped by. Two Chrome tabs on
   * the same org read one inventory; a different org gets its own.
   */
  oktaOrigin?: string | null;
  /**
   * Whether the Applications tab is the visible one. The tab stays mounted while
   * hidden, and the auto-load re-arms on every new `targetTabId` — so without
   * this gate, switching Okta tabs would silently re-page the whole app
   * inventory from a tab nobody is looking at. Deferred, not dropped: the load
   * runs the next time the tab is shown. Defaults to `true`.
   */
  enabled?: boolean;
}

/** Return shape of {@link useAppsData}. */
export interface UseAppsDataReturn {
  /** Every app in the org, as far as the snapshot has them. */
  apps: OktaAppListItem[];
  /** Whether a load is in flight. */
  isLoading: boolean;
  /** ISO timestamp of the last completed full walk, or `null`. */
  lastFetchTime: string | null;
  /**
   * Whether the last walk finished. `false` means the list is a genuine prefix
   * of the org, not the whole of it (ADR-0040 §7).
   */
  complete: boolean;
  /** Load the inventory; `force` walks in full (the header's Refresh). */
  loadApps: (force?: boolean) => Promise<void>;
}

/**
 * Manage the Applications tab's data: the inventory, the loading flag, the
 * last-fetch timestamp, and the `loadApps` pipeline.
 *
 * @param options - See {@link UseAppsDataOptions}.
 * @returns See {@link UseAppsDataReturn}.
 */
export function useAppsData({
  onError,
  targetTabId,
  oktaOrigin,
  enabled = true,
}: UseAppsDataOptions): UseAppsDataReturn {
  const snapshot = useOrgSnapshot<OktaAppListItem>('apps', oktaOrigin, targetTabId, { enabled });
  const { rows: apps, sync, isSyncing, isReading, complete, lastFullWalkAt } = snapshot;

  const loadApps = useCallback(
    async (force: boolean = false) => {
      if (targetTabId == null) {
        onError('No Okta tab connected');
        return;
      }
      onError('');
      const failure = await sync(force);
      if (failure) {
        onError(failure);
        // Identifiers and outcome codes only — never app labels or a body.
        log.error('Failed to load applications', { code: 'load_apps_failed' });
      }
    },
    [onError, sync, targetTabId],
  );

  // Auto-load once per connected *target*, and only while the Applications tab
  // is the visible one.
  //
  // The target is the `(tab id, origin)` pair, not the tab id alone: navigating
  // a single Chrome tab from one org to another changes the origin while the id
  // stays put, and a tab-id-only guard would never re-arm — leaving the panel
  // showing the previous org's inventory indefinitely. Re-arming is cheap: an
  // unforced load runs the freshness ladder, which for a warm org is one request
  // or none.
  //
  // `\u0000` as an escape, never a literal NUL: a raw control byte in source
  // makes this file binary to grep(1) and every tool built on it, and is
  // invisible in editors and diffs. Same runtime string either way.
  useOwedLoad(
    targetTabId == null ? null : `${targetTabId}\u0000${oktaOrigin ?? ''}`,
    enabled,
    () => {
      void loadApps();
    },
  );

  return {
    apps,
    isLoading: isSyncing || isReading,
    // Reported from the walk that actually produced these rows, not stamped at
    // the call site: an origin-scoped snapshot may have been filled by another
    // Chrome tab's panel session, or by the background with no panel open at all.
    lastFetchTime: lastFullWalkAt === null ? null : new Date(lastFullWalkAt).toISOString(),
    complete,
    loadApps,
  };
}
