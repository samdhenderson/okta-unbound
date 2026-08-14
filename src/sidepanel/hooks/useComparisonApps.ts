/**
 * @module sidepanel/hooks/useComparisonApps
 * @description Loads and holds the app-assignment side of the user-comparison view.
 *
 * Extracted from `UserComparisonModal`; owns fetching both users' app lists whenever
 * the compared user changes and exposing them plus a loading flag to the modal.
 */

import { useState, useEffect, useCallback } from 'react';
import { useOktaApi } from './useOktaApi';
import type { OktaUser } from '../../shared/types';
import type { AppEntry } from '../components/users/comparison/comparisonAnalytics';

/** Inputs to {@link useComparisonApps}. */
interface UseComparisonAppsOptions {
  /** Tab id of the Okta session to query through. */
  targetTabId: number;
  /** The fixed "context" user (left-hand side of the comparison). */
  contextUserId: string;
  /** The user currently being compared against, or `null` when none is selected. */
  comparedUser: OktaUser | null;
}

/** Value returned by {@link useComparisonApps}. */
interface UseComparisonAppsReturn {
  /** App assignments for the context user. */
  contextApps: AppEntry[];
  /** App assignments for the compared user. */
  comparedApps: AppEntry[];
  /** True while both users' app lists are being (re)fetched. */
  isLoadingApps: boolean;
  /** Clears both app lists (but not the loading flag). */
  resetApps: () => void;
}

/**
 * Owns the app-assignment half of the comparison: both users' apps are refetched
 * together every time `comparedUser` changes (they are not cached or keyed by the
 * context user). The load is guarded by a `cancelled` flag so a stale run cannot
 * write state.
 *
 * There is deliberately no error state here: `getUserApps`
 * (`useOktaApi/userOperations.ts`) wraps its whole pagination walk in try/catch and
 * always resolves with whatever it accumulated, so this hook's promise can never
 * reject. An app-API failure renders as "0 apps", never as an error — characterized
 * in `UserComparisonModal.test.tsx`'s "app-fetch resilience" suite. Surfacing it
 * would be a UX change for §8, not this hook's job.
 */
export function useComparisonApps({
  targetTabId,
  contextUserId,
  comparedUser,
}: UseComparisonAppsOptions): UseComparisonAppsReturn {
  const { getUserApps } = useOktaApi({ targetTabId: targetTabId ?? null });

  const [contextApps, setContextApps] = useState<AppEntry[]>([]);
  const [comparedApps, setComparedApps] = useState<AppEntry[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);

  useEffect(() => {
    if (!comparedUser) return;

    let cancelled = false;
    setIsLoadingApps(true);
    // No .catch: getUserApps never rejects (see the class doc above), so there is
    // nothing here for one to catch.
    Promise.all([getUserApps(contextUserId), getUserApps(comparedUser.id)])
      .then(([ctxApps, cmpApps]) => {
        if (cancelled) return;
        setContextApps(ctxApps);
        setComparedApps(cmpApps);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingApps(false);
      });

    return () => {
      cancelled = true;
    };
    // Kept keyed on [comparedUser] only — getUserApps is stable now that useOktaApi
    // is memoized; widening the deps is a deliberate follow-up, not this split.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparedUser]);

  // Clears the app lists, but deliberately NOT isLoadingApps — matching the
  // original, where neither reset path touched the loading flag.
  const resetApps = useCallback(() => {
    setContextApps([]);
    setComparedApps([]);
  }, []);

  return { contextApps, comparedApps, isLoadingApps, resetApps };
}
