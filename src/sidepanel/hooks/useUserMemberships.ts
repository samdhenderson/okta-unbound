/**
 * @module sidepanel/hooks/useUserMemberships
 * @description Loads a user's groups and classifies each membership as DIRECT or RULE_BASED.
 *
 * Okta's API does not report how a user landed in a group, so this module infers
 * it heuristically via `shared/utils/membershipAnalysis` (APP_GROUP → rule,
 * rule-exclusion → direct, matching active rules → rule, otherwise direct).
 * Group rules are read from the shared `RulesCache` and refetched on a miss.
 *
 * ## This is the *heuristic-only* attribution path (ADR-0020)
 *
 * The group view resolves the same question authoritatively — it reads Okta's
 * own `_embedded['group-rules']` off the member listing
 * (`shared/membership/memberRuleAttribution`). **This path has no equivalent**:
 * `GET /api/v1/users/{id}/groups` carries no attribution embed (see
 * `getUserGroupsRequest`), so every answer here is client-evaluated and is
 * labelled as such by the `attribution` each membership carries. Where Okta
 * asserted nothing the two views agree exactly; where it asserted something they
 * may differ, and the difference is provenance, not a bug —
 * `shared/membership/attributionParity.test.ts` pins both halves of that.
 *
 * ## The rule inventory is load-bearing
 *
 * Classifying against an empty or partial rule list makes every group look
 * untargeted, which the heuristic reports as `DIRECT` / `attribution: 'exact'` —
 * a confident "added by hand" invented out of a failed fetch. So a failure to
 * obtain the rules is **not** degraded gracefully into an analysis: the load
 * reports `unclassifiedMemberships` (`UNKNOWN` / `ambiguous`) and the degraded
 * result is dropped from the cache so the next visit retries.
 *
 * The same inventory is handed back to callers as {@link UseUserMembershipsReturn.rules},
 * carrying that `[]`-vs-`null` distinction intact — it is the *same* bytes this
 * load already obtained, re-exported rather than re-fetched, so reading it costs
 * no additional API request (see the field's own doc comment).
 */

import { useState, useCallback, useRef } from 'react';
import type { OktaUser, GroupMembership, OktaGroup, FormattedRule } from '../../shared/types';
import { RulesCache } from '../../shared/rulesCache';
import { getOrFetch, peek, invalidate } from '../cache/entityCache';
import { analyzeMemberships, unclassifiedMemberships } from '../../shared/utils/membershipAnalysis';
import { createLogger } from '../../shared/utils/logger';
import { useOktaApi } from './useOktaApi';
import { getUserGroupsRequest } from './getUserGroupsRequest';
import { fetchGroupRulesRequest } from './fetchGroupRulesRequest';

const log = createLogger('useUserMemberships');

/** Options for {@link useUserMemberships}. */
interface UseUserMembershipsOptions {
  /** Tab whose content script fetches groups/rules; loading errors when undefined. */
  targetTabId: number | undefined;
  /**
   * Notified whenever the load error changes — `null` on start/success, the
   * message on failure. Lets an orchestrator mirror this into a single merged
   * error channel it owns (last-write-wins). Optional; consumers that read the
   * returned `error` directly can omit it.
   */
  onError?: (message: string | null) => void;
  /** Notified when a load starts (`true`) and settles (`false`). Optional. */
  onLoadingChange?: (loading: boolean) => void;
}

/** Return shape of {@link useUserMemberships}. */
interface UseUserMembershipsReturn {
  memberships: GroupMembership[];
  isLoading: boolean;
  error: string | null;
  /**
   * The org-wide group-rule inventory the last completed load classified
   * against — **not** a second fetch. It is the array this hook already read
   * from `RulesCache` (or already fetched on a miss) and then used for
   * `analyzeMemberships`, re-exported so callers that must answer "why does this
   * user *not* have that group" can ask the same question of the same rules.
   * Reading it issues nothing.
   *
   * ## `[]` and `null` are different facts — never conflate them
   *
   * - `[]` — the load obtained the inventory and **the org genuinely has no
   *   rules**. Anything untargeted really is untargeted.
   * - `null` — **the inventory could not be obtained** (the fetch failed, or no
   *   load has completed in this hook instance yet). Nothing may be concluded
   *   from a group looking untargeted.
   *
   * This is the same distinction that makes a failed rules fetch report
   * `UNKNOWN` / `ambiguous` instead of a confident `DIRECT` (see the module
   * header). Consumers must thread `null` through **as `null`** — defaulting it
   * with `?? []` turns "we do not know" into "there are no rules", which is
   * exactly the confident-wrong-answer this hook exists to avoid.
   *
   * Survives `clearMemberships` and a change of user on purpose: the inventory
   * is org-wide, not user-scoped, so discarding it would manufacture a "we do
   * not know" out of knowledge already in hand.
   */
  rules: FormattedRule[] | null;
  /**
   * (Re)load a user's analyzed memberships. A fresh cached analysis is served
   * instantly; pass `{ force: true }` after a mutation (e.g. add-to-group) to
   * bypass the cache and refetch.
   */
  loadMemberships: (user: OktaUser, options?: { force?: boolean }) => Promise<void>;
  clearMemberships: () => void;
}

/**
 * Hook for loading and analyzing a user's group memberships.
 *
 * Features:
 * - Fetches user's groups from Okta API
 * - Uses cached rules when available
 * - Analyzes membership types (DIRECT vs RULE_BASED)
 *
 * @param options - See `UseUserMembershipsOptions`.
 * @returns `memberships` (each annotated with its inferred type), `isLoading`,
 *   `error`, `rules` (the inventory the last load classified against — `null`
 *   when it could not be obtained, which is **not** `[]`),
 *   `loadMemberships(user)` to (re)load for a user, and `clearMemberships` to
 *   reset.
 */
export function useUserMemberships({
  targetTabId,
  onError,
  onLoadingChange,
}: UseUserMembershipsOptions): UseUserMembershipsReturn {
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The inventory the last completed load classified against. Starts `null` —
  // "we have not obtained the org's rules" — and is only ever written with what
  // a load actually saw, `null` included. See `UseUserMembershipsReturn.rules`.
  const [ruleInventory, setRuleInventory] = useState<FormattedRule[] | null>(null);

  // §8: own a useOktaApi slice so the group fetch routes through the background
  // scheduler. `makeApiRequest` is stable per `targetTabId`, so it does not widen
  // `loadMemberships`'s dependency surface (the auto-load guard still holds).
  const { makeApiRequest } = useOktaApi({ targetTabId: targetTabId ?? null });

  // Held in a ref so `loadMemberships` keeps a stable identity regardless of
  // whether callers pass inline callbacks — the auto-load effect that depends
  // on it must not re-run on every render.
  const callbacksRef = useRef({ onError, onLoadingChange });
  callbacksRef.current = { onError, onLoadingChange };

  const reportError = useCallback((message: string | null) => {
    setError(message);
    callbacksRef.current.onError?.(message);
  }, []);
  const reportLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
    callbacksRef.current.onLoadingChange?.(loading);
  }, []);

  const loadMemberships = useCallback(
    async (user: OktaUser, options?: { force?: boolean }) => {
      if (!targetTabId) {
        reportError('No Okta tab connected');
        return;
      }

      reportError(null);

      // Serve a fresh cached analysis instantly (no loading flash) unless forcing.
      // Re-navigating back to a user, or re-selecting one, then costs nothing.
      if (!options?.force) {
        const cached = peek<GroupMembership[]>(['userMemberships', user.id]);
        if (cached) {
          setMemberships(cached);
          // Own the loading lifecycle fully: a caller (e.g. the Users tab's detected-
          // user "Load") may have flipped loading on before calling us, so clear it
          // here too — otherwise a cache hit leaves the spinner stuck on forever.
          reportLoading(false);
          return;
        }
      }

      reportLoading(true);

      // Set by the fetcher when it had to fall back to an unclassified result.
      // Read after the await so a coalesced caller sees it too.
      let degraded = false;

      try {
        // Fetch + analyze through the entity cache so concurrent callers de-dup and
        // the result is reused on remount. `force` bypasses cache + in-flight.
        const analyzedMemberships = await getOrFetch<GroupMembership[]>(
          ['userMemberships', user.id],
          async () => {
            log.debug('Loading memberships for user:', user.id);

            // Fetch user's groups (§8: scheduler-routed, was a direct getUserGroups message)
            const groupsResponse = await getUserGroupsRequest(makeApiRequest, user.id);

            if (!groupsResponse.success) {
              throw new Error(groupsResponse.error || 'Failed to fetch user groups');
            }

            // Check cache for rules first. `rules === null` is "we do not have
            // the org's rules", which is NOT the same as "the org has none" —
            // conflating them is what turns a failed fetch into a confident
            // "added by hand" for every group (see the module header).
            let rules: FormattedRule[] | null = null;
            const cachedRules = await RulesCache.get();

            if (cachedRules) {
              log.debug('Using cached rules from global cache');
              rules = cachedRules.rules;
            } else {
              // Cache miss - fetch rules (§8: scheduler-routed, was a fetchGroupRules message).
              // Membership analysis matches only on group ids, condition expressions,
              // and user attributes — never a resolved group name — so skip the
              // per-referenced-group name fan-out (otherwise hundreds of wasted
              // GET /groups/{id} calls just to load one user's memberships).
              log.debug('Cache miss - fetching rules (names not needed for analysis)');
              const rulesResponse = await fetchGroupRulesRequest(makeApiRequest, undefined, {
                resolveGroupNames: false,
              });

              if (!rulesResponse.success) {
                log.warn('Could not fetch rules for analysis:', rulesResponse.error);
              } else {
                rules = rulesResponse.rules || [];
                // Intentionally NOT populating RulesCache here: these rules carry
                // ids-as-names (name resolution was skipped), and the Rules tab
                // relies on the shared cache holding real group names.
              }
            }

            // Publish the inventory this load will classify against, exactly as
            // obtained — `null` stays `null`. No request is issued here: either
            // the RulesCache read above served it or the single scheduler-routed
            // fetch above already paid for it.
            setRuleInventory(rules);

            // Extract raw groups from membership wrapper objects
            // groupsResponse.data is an array of { group, membershipType, addedDate }
            const membershipData: Array<{ group?: OktaGroup }> = groupsResponse.data || [];
            const rawGroups: OktaGroup[] = membershipData.map(
              (m) => m.group || (m as unknown as OktaGroup),
            );

            // No rule inventory → say "unknown", never "added by hand".
            if (rules === null) {
              degraded = true;
              log.warn('Rules unavailable; reporting memberships as unclassified', {
                userId: user.id,
                groups: rawGroups.length,
              });
              return unclassifiedMemberships(rawGroups);
            }

            return analyzeMemberships(rawGroups, rules, user);
          },
          { force: options?.force },
        );

        // An unclassified result describes the load that failed, not the org —
        // banking it would keep the user staring at "UNKNOWN" for the whole TTL
        // even after the rules became available. Show it, then forget it.
        if (degraded) invalidate(['userMemberships', user.id]);

        setMemberships(analyzedMemberships);
        log.debug('Loaded memberships:', { count: analyzedMemberships.length, degraded });
      } catch (err) {
        reportError(err instanceof Error ? err.message : 'Failed to load user memberships');
        setMemberships([]);
        log.error('Membership loading error:', err);
      } finally {
        reportLoading(false);
      }
    },
    [targetTabId, reportError, reportLoading, makeApiRequest],
  );

  const clearMemberships = useCallback(() => {
    setMemberships([]);
    reportError(null);
  }, [reportError]);

  return {
    memberships,
    isLoading,
    error,
    rules: ruleInventory,
    loadMemberships,
    clearMemberships,
  };
}
