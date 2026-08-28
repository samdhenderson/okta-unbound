/**
 * @module sidepanel/hooks/useComparisonApps
 * @description Loads and holds the app-assignment side of the user-comparison view.
 *
 * Extracted from the retired `UserComparisonModal`; owns fetching both users' app lists whenever
 * the compared user changes and exposing them plus a loading flag to the modal.
 */

import { useState, useEffect, useCallback } from 'react';
import { useOktaApi } from './useOktaApi';
import type { OktaUser } from '../../shared/types';
import type { UserAppAssignment } from './useOktaApi/userOperations';

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
  /**
   * App assignments for the context user.
   *
   * The full {@link UserAppAssignment} rather than the narrower `AppEntry` the
   * comparison's diffing needs: `isProfileSource` rides the same walk and is what
   * the profile-editability gate resolves a `PROFILE_MASTER` attribute against.
   * `AppEntry` is a structural subset, so every existing consumer is unaffected.
   */
  contextApps: UserAppAssignment[];
  /** App assignments for the compared user. See {@link contextApps}. */
  comparedApps: UserAppAssignment[];
  /** True while both users' app lists are being (re)fetched. */
  isLoadingApps: boolean;
  /**
   * Whether a walk has actually returned.
   *
   * The same distinction `useUserApps.hasLoaded` draws, and needed here for the
   * same reason: an empty `contextApps` means *either* nothing has loaded yet
   * *or* the walk finished and the user genuinely has no apps. A consumer that
   * collapses the two reads "no profile source" off a list that has not arrived,
   * and unlocks attributes it cannot yet prove anything about.
   */
  appsLoaded: boolean;
  /**
   * True when **either** user's app walk did not finish, so the lists above are
   * short by an unknown amount. Consumers must not present a count, an overlap
   * percentage, or an "only X has this" conclusion drawn from them as fact.
   */
  appsIncomplete: boolean;
  /** Clears both app lists (but not the loading flag). */
  resetApps: () => void;
}

/**
 * Owns the app-assignment half of the comparison: both users' apps are refetched
 * together every time `comparedUser` changes (they are not cached or keyed by the
 * context user). The load is guarded by a `cancelled` flag so a stale run cannot
 * write state.
 *
 * `getUserApps` never rejects — it resolves with whatever pages it collected plus
 * a `complete` flag — so there is no `.catch` here and no error *message* to
 * render. What there is instead is {@link UseComparisonAppsReturn.appsIncomplete}:
 * a failed or part-way-failed walk used to arrive as an empty array and render as
 * "0 apps", which reads as a finding about someone's access rather than as a
 * failure to look. The flag is what stops the rest of the comparison stating a
 * number it cannot stand behind.
 *
 * It is a boolean rather than a message because the failure is not actionable in
 * this surface — the useful thing to say is "this half of the comparison is
 * unreliable", not which HTTP status the third page returned. The status is
 * logged at the boundary.
 */
export function useComparisonApps({
  targetTabId,
  contextUserId,
  comparedUser,
}: UseComparisonAppsOptions): UseComparisonAppsReturn {
  const { getUserApps } = useOktaApi({ targetTabId: targetTabId ?? null });

  const [contextApps, setContextApps] = useState<UserAppAssignment[]>([]);
  const [comparedApps, setComparedApps] = useState<UserAppAssignment[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  // Starts false and is cleared by `resetApps`, so "the lists are empty because
  // nothing has run" never reads as "the lists are empty because there is
  // nothing". See the field doc on the return type.
  const [appsLoaded, setAppsLoaded] = useState(false);
  // Starts false and is only ever set from a completed load: "nothing has failed"
  // is the honest reading before anything has been attempted.
  const [appsIncomplete, setAppsIncomplete] = useState(false);

  useEffect(() => {
    if (!comparedUser) return;

    let cancelled = false;
    setIsLoadingApps(true);
    // No .catch: getUserApps never rejects (see the class doc above), so there is
    // nothing here for one to catch. A failure arrives as `complete: false`.
    Promise.all([getUserApps(contextUserId), getUserApps(comparedUser.id)])
      .then(([context, compared]) => {
        if (cancelled) return;
        setContextApps(context.apps);
        setComparedApps(compared.apps);
        // Either side being short is enough to make the *comparison* unreliable:
        // the buckets are a set difference, so a missing row on one side becomes a
        // spurious "only the other user has this".
        setAppsIncomplete(!context.complete || !compared.complete);
        setAppsLoaded(true);
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
  // original, where neither reset path touched the loading flag. The incomplete
  // flag does clear: it describes the lists being cleared, so leaving it set would
  // caveat a comparison that has not been made yet.
  const resetApps = useCallback(() => {
    setContextApps([]);
    setComparedApps([]);
    setAppsIncomplete(false);
    // Cleared with the lists it describes. Leaving it set would present the
    // emptied arrays as a finished answer — which is how a reset came to unlock
    // every profile-mastered attribute until the next walk returned.
    setAppsLoaded(false);
  }, []);

  return { contextApps, comparedApps, isLoadingApps, appsLoaded, appsIncomplete, resetApps };
}
