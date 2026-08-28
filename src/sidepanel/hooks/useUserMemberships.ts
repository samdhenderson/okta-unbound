/**
 * @module sidepanel/hooks/useUserMemberships
 * @description Loads a user's groups and classifies each membership as DIRECT or RULE_BASED.
 *
 * Okta's API does not report how a user landed in a group, so this module infers
 * it heuristically via `shared/utils/membershipAnalysis` (APP_GROUP → rule,
 * rule-exclusion → direct, matching active rules → rule, otherwise direct).
 * Group rules come from the background-owned org snapshot's `rules` collection
 * and are refetched only when that collection has no completed walk for this org.
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
 * as a {@link RuleInventoryState} that keeps three separate answers apart —
 * obtained, could-not-obtain, and not-resolved-yet (see the type's own doc comment).
 *
 * ## One source of rules, joined at read time (D-029b)
 *
 * The inventory used to come from `shared/rulesCache`, a `chrome.storage.local`
 * slot with its own five-minute TTL. That made "why is this user in this group"
 * and every other rule-derived answer on screen readable from two stores that
 * could disagree, with nothing detecting or showing the disagreement. It now
 * derives from the snapshot's raw rows the way `useGroupsLoader` does —
 * `detectConflicts` once, then `formatRuleForDisplay` per row — because caching
 * a join is only one more thing to invalidate.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  OktaUser,
  GroupMembership,
  OktaGroup,
  OktaGroupRule,
  FormattedRule,
} from '../../shared/types';
import { detectConflicts, formatRuleForDisplay } from '../../shared/ruleUtils';
import { orgSnapshotStore } from '../../shared/snapshot/orgSnapshotStore';
import { getOrFetch, peek, setEntry, invalidate } from '../cache/entityCache';
import { cacheKeys } from '../cache/keys';
import { analyzeMemberships, unclassifiedMemberships } from '../../shared/utils/membershipAnalysis';
import { createLogger } from '../../shared/utils/logger';
import { useOktaApi } from './useOktaApi';
import { getUserGroupsRequest } from './getUserGroupsRequest';
import { fetchGroupRulesRequest } from './fetchGroupRulesRequest';

const log = createLogger('useUserMemberships');

/**
 * Entity-cache key for the org-wide rule inventory.
 *
 * Its own key rather than a field of one user's cached analysis: the inventory is
 * org-wide, so every user's load asks the same question and should share one
 * answer. Caching it here is what lets a *memberships* cache hit — which skips the
 * fetcher entirely — still end up holding the rules without paying a second fetch
 * per user.
 *
 * It also holds the derived join: `detectConflicts` is quadratic in the org's
 * rule count, so paying it once per key rather than once per consumer is the
 * point of publishing here rather than deriving in each caller.
 */
const RULE_INVENTORY_KEY = 'groupRuleInventory';

/**
 * What is known about the org's group-rule inventory.
 *
 * Three answers that must never collapse into two. The classifier already treats
 * `[]` ("the org has no rules") and `null` ("we could not obtain them") as
 * different facts; this type adds the third the UI kept mistaking for the second:
 *
 * - `unresolved` — **no attempt has completed yet.** Nothing may be concluded, and
 *   nothing may be *reported* either. A consumer must render this as "not computed",
 *   never as a finding.
 * - `available` — the inventory was obtained. `rules` may legitimately be empty,
 *   which means the org genuinely has no rules.
 * - `unavailable` — an attempt completed and failed. This is a real, reportable
 *   answer: nothing can be concluded from a group looking untargeted.
 *
 * Folding `unresolved` into `unavailable` is what made the comparison's worklist
 * announce "the rules targeting this group could not be loaded" for every row
 * during the ordinary gap before they arrive — a confident wrong answer about a
 * failure that never happened.
 */
export type RuleInventoryState =
  | { readonly status: 'unresolved' }
  | { readonly status: 'available'; readonly rules: FormattedRule[] }
  | { readonly status: 'unavailable' };

/** Options for {@link useUserMemberships}. */
interface UseUserMembershipsOptions {
  /** Tab whose content script fetches groups/rules; loading errors when undefined. */
  targetTabId: number | undefined;
  /**
   * Connected org origin — what the org snapshot's `rules` collection is scoped
   * by, and therefore where the rule inventory is read from.
   *
   * `null`/`undefined` before it resolves, which reads nothing rather than
   * reading some other org's rules; the inventory then falls back to the
   * paginated fetch below, exactly as a cold snapshot does. Omitting it is
   * legal and costs one rules listing per cache TTL.
   */
  oktaOrigin?: string | null;
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
   * The org-wide group-rule inventory this hook classifies against, re-exported
   * so callers that must answer "why does this user *not* have that group" can
   * ask the same question of the same rules.
   *
   * Resolved on **every** load path and shared through
   * {@link RULE_INVENTORY_KEY}, so it costs at most one fetch per cache TTL
   * across all users rather than one per user. The two paths differ in what they
   * are allowed to do about a miss:
   *
   * - A load that fetches resolves it fully, falling back to a rules listing
   *   when the snapshot has no completed walk for this org, and publishes
   *   `unavailable` if that attempt fails.
   * - A **memberships cache hit** may only adopt an inventory already in hand —
   *   the entity cache or the snapshot, both local: it must issue no request.
   *   With neither holding rules this stays `unresolved`.
   *
   * Either way it resolves *after* the memberships land, so this can legitimately
   * read `unresolved` on the render that first shows them; consumers must render
   * that state as "not computed" rather than as a finding. See
   * {@link RuleInventoryState} for why the three states never merge.
   *
   * Consumers must also keep the `available`-with-`[]` case distinct from
   * `unavailable`: reading an empty inventory as "we could not tell" (or the
   * reverse, `?? []`) is exactly the confident-wrong-answer this hook exists to
   * avoid.
   *
   * Survives `clearMemberships` and a change of user on purpose: the inventory
   * is org-wide, not user-scoped, so discarding it would manufacture a "we do
   * not know" out of knowledge already in hand.
   */
  rules: RuleInventoryState;
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
 * - Derives the org rule inventory from the org snapshot, listing rules only
 *   when the snapshot has no completed walk for the connected org
 * - Analyzes membership types (DIRECT vs RULE_BASED)
 *
 * @param options - See `UseUserMembershipsOptions`.
 * @returns `memberships` (each annotated with its inferred type), `isLoading`,
 *   `error`, `rules` (the org rule inventory as a three-state
 *   {@link RuleInventoryState} — not yet resolved, obtained, or could-not-obtain),
 *   `loadMemberships(user)` to (re)load for a user, and `clearMemberships` to
 *   reset.
 */
export function useUserMemberships({
  targetTabId,
  oktaOrigin,
  onError,
  onLoadingChange,
}: UseUserMembershipsOptions): UseUserMembershipsReturn {
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Starts `unresolved` — "nobody has tried yet" — which is a different claim
  // from the `unavailable` an attempt writes when it fails. Only ever written
  // with what an attempt actually saw. See `UseUserMembershipsReturn.rules`.
  const [ruleInventory, setRuleInventory] = useState<RuleInventoryState>({ status: 'unresolved' });

  // §8: own a useOktaApi slice so the group fetch routes through the background
  // scheduler. `makeApiRequest` is stable per `targetTabId`, so it does not widen
  // `loadMemberships`'s dependency surface (the auto-load guard still holds).
  const { makeApiRequest } = useOktaApi({ targetTabId: targetTabId ?? null });

  // Held in a ref so `loadMemberships` keeps a stable identity regardless of
  // whether callers pass inline callbacks — the auto-load effect that depends
  // on it must not re-run on every render.
  const callbacksRef = useRef({ onError, onLoadingChange });
  callbacksRef.current = { onError, onLoadingChange };

  // Held in a ref for the same reason, and it matters more here: the origin
  // resolves a beat after mount, so keying the inventory callbacks on it would
  // change `loadMemberships`'s identity mid-flight and re-run every caller's
  // `[selectedUser, loadMemberships]` effect — one of which reloads with
  // `{ force: true }`. Read at call time instead, which is also the value the
  // load should be reading the org's rules for.
  const oktaOriginRef = useRef(oktaOrigin);
  oktaOriginRef.current = oktaOrigin;

  const reportError = useCallback((message: string | null) => {
    setError(message);
    callbacksRef.current.onError?.(message);
  }, []);
  const reportLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
    callbacksRef.current.onLoadingChange?.(loading);
  }, []);

  /**
   * Derive the org's rule inventory from the snapshot, or `null` when the
   * snapshot cannot answer for this org yet.
   *
   * The join is computed here rather than stored, following
   * `useGroupsLoader`: `detectConflicts` over the raw rows once, then
   * `formatRuleForDisplay(rule, undefined, conflicts)` per row. No
   * `currentGroupId` is passed because the inventory is org-wide — baking one
   * group's `affectsCurrentGroup` flag into it would be wrong for every other
   * consumer (the reason `groupDiscovery` gives for the same call).
   *
   * The gate is the collection's `complete` flag, not "the snapshot returned
   * rows" (D-038, ADR-0040 §7). A partial walk is a prefix of the org, and this
   * inventory is load-bearing: a rule missing from it makes its target group
   * look untargeted, which the classifier reports as a confident "added by
   * hand". An org with genuinely zero rules is a real answer (`[]`), which the
   * row count could not distinguish from a cold store.
   *
   * @returns The derived display rules, or `null` when no origin has resolved
   * or the `rules` walk has not completed for it.
   */
  const deriveSnapshotRuleInventory = useCallback(async (): Promise<FormattedRule[] | null> => {
    const origin = oktaOriginRef.current;
    if (!origin) return null;
    const meta = await orgSnapshotStore.getMeta('rules', origin);
    if (!meta.complete) return null;
    // Rows were zod-parsed against `oktaGroupRuleSchema` on write by the
    // background walk (ADR-0006), so this is a read of already-validated data.
    const rawRules = await orgSnapshotStore.getCollection<OktaGroupRule>('rules', origin);
    const conflicts = detectConflicts(rawRules);
    return rawRules.map((rule) => formatRuleForDisplay(rule, undefined, conflicts));
  }, []);

  /**
   * Adopt the rule inventory **only if it is already in hand**, issuing no request.
   *
   * Both reads are local: the entity cache is in memory, and the org snapshot is
   * IndexedDB the background already filled. Neither touches the content script.
   *
   * Finding nothing deliberately leaves the state alone rather than writing
   * `unavailable` — "nobody has fetched these yet" is not "the fetch failed", and
   * only a real attempt may claim the latter.
   */
  const adoptCachedRuleInventory = useCallback(async (): Promise<void> => {
    const cached = peek<FormattedRule[] | null>(RULE_INVENTORY_KEY);
    if (cached) {
      setRuleInventory({ status: 'available', rules: cached });
      return;
    }
    const derived = await deriveSnapshotRuleInventory();
    if (!derived) return;
    // Publish the join, not just the state: the next consumer — another user's
    // load, or this hook after a remount — then peeks it instead of paying the
    // quadratic conflict pass again.
    setEntry(RULE_INVENTORY_KEY, derived);
    setRuleInventory({ status: 'available', rules: derived });
  }, [deriveSnapshotRuleInventory]);

  /**
   * Obtain the org rule inventory and publish it, returning what was obtained.
   *
   * Shared through the entity cache under {@link RULE_INVENTORY_KEY} so the
   * memberships-cache-hit path and the fetcher path coalesce onto one request,
   * and so a second user's comparison reuses the first's answer.
   *
   * `null` is returned — and published as `unavailable` — only when an attempt
   * genuinely failed. It is never cached: banking a failure would keep every
   * later load reporting "could not be obtained" for the whole TTL, long after
   * the rules became reachable again.
   */
  const loadRuleInventory = useCallback(async (): Promise<FormattedRule[] | null> => {
    const rules = await getOrFetch<FormattedRule[] | null>(RULE_INVENTORY_KEY, async () => {
      const derived = await deriveSnapshotRuleInventory();
      if (derived) {
        log.debug('Deriving the rule inventory from the org snapshot', { count: derived.length });
        return derived;
      }

      // No completed walk for this org yet. Membership analysis matches only on
      // group ids, condition expressions, and user attributes — never a
      // resolved group name — so skip the per-referenced-group name fan-out
      // (otherwise hundreds of wasted GET /groups/{id} calls just to load one
      // user's memberships).
      log.debug('Snapshot cold - fetching rules (names not needed for analysis)');
      const rulesResponse = await fetchGroupRulesRequest(makeApiRequest, undefined, {
        resolveGroupNames: false,
      });

      if (!rulesResponse.success) {
        log.warn('Could not fetch rules for analysis:', rulesResponse.error);
        return null;
      }
      return rulesResponse.rules || [];
    });

    if (rules === null) invalidate(RULE_INVENTORY_KEY);

    setRuleInventory(rules === null ? { status: 'unavailable' } : { status: 'available', rules });
    return rules;
  }, [deriveSnapshotRuleInventory, makeApiRequest]);

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
        const cached = peek<GroupMembership[]>(cacheKeys.userMemberships(user.id));
        if (cached) {
          setMemberships(cached);
          // Own the loading lifecycle fully: a caller (e.g. the Users tab's detected-
          // user "Load") may have flipped loading on before calling us, so clear it
          // here too — otherwise a cache hit leaves the spinner stuck on forever.
          reportLoading(false);
          // The analysis is cached; the inventory is per-instance state, so
          // without this a cache hit left it `unresolved` forever and every
          // downstream "why not" answer degraded to "the rules could not be
          // loaded". Adopt-only, never fetch: this path must issue no request
          // (pinned by `useUserMemberships.test.tsx`) and must not reintroduce
          // the loading flash it exists to avoid, so it is not awaited either.
          // Nothing cached leaves the state `unresolved`, which reports as "not
          // computed" rather than as a failure that never happened.
          void adoptCachedRuleInventory();
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
          cacheKeys.userMemberships(user.id),
          async () => {
            log.debug('Loading memberships for user:', user.id);

            // Fetch user's groups (§8: scheduler-routed, was a direct getUserGroups message)
            const groupsResponse = await getUserGroupsRequest(makeApiRequest, user.id);

            if (!groupsResponse.success) {
              throw new Error(groupsResponse.error || 'Failed to fetch user groups');
            }

            // Obtain and publish the inventory this load will classify against.
            // `null` is "we do not have the org's rules", which is NOT the same
            // as "the org has none" — conflating them is what turns a failed
            // fetch into a confident "added by hand" for every group.
            const rules = await loadRuleInventory();

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
        if (degraded) invalidate(cacheKeys.userMemberships(user.id));

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
    // Both inventory callbacks are keyed on stable values (`makeApiRequest`, and
    // the snapshot derive, which reads the origin from a ref rather than taking
    // it as a dep), so this keeps the stable identity the auto-load guard
    // depends on.
    [
      targetTabId,
      reportError,
      reportLoading,
      makeApiRequest,
      loadRuleInventory,
      adoptCachedRuleInventory,
    ],
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
