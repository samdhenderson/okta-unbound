/**
 * @module sidepanel/hooks/useGroupSource
 * @description Loads the "why does this group exist?" insight for one group.
 *
 * Two tiers, mirroring the MFA scan's cheap-then-gated pattern: opening a group
 * loads its feeding rules (cheap, cache-backed); the manual-vs-rule member split
 * is an opt-in analysis that fetches the group's members (one paginated read) and
 * classifies each with the shared membership heuristic. Read-only.
 *
 * This is the **only** place a member-source breakdown is computed. Each result
 * is banked in {@link module:sidepanel/cache/memberSourceCache} so cheap,
 * fetch-less consumers — every row's compact meter in the groups list — can show
 * the split without paying for it again.
 *
 * Both halves of the analysis read through a cache, so re-opening the same group
 * costs nothing: the rules half is served by `RulesCache` inside
 * {@link module:hooks/useOktaApi/groupDiscovery}, and the member half by the
 * shared entity cache under `['groupMembers', groupId]` — the same key
 * `GroupOverview` and {@link module:sidepanel/hooks/useGroupMembersCache} use.
 */

import { useCallback, useRef, useState } from 'react';
import type { GroupSummary, OktaUser } from '../../shared/types';
import { useOktaApi } from './useOktaApi';
import {
  summarizeMemberSources,
  type MemberSourceBreakdown,
} from '../../shared/membership/groupSource';
import { writeMemberSource } from '../cache/memberSourceCache';
import { getOrFetch } from '../cache/entityCache';
import { cacheKeys } from '../cache/keys';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useGroupSource');

/** Async status of a load step. */
export type SourceStatus = 'idle' | 'loading' | 'done' | 'error';

/** A feeding rule reduced to what the modal displays. */
export interface FeedingRule {
  id: string;
  name: string;
  status: string;
}

/** Return shape of {@link useGroupSource}. */
export interface UseGroupSourceReturn {
  /** The group under examination, or null when closed. */
  group: GroupSummary | null;
  /** Rules that assign users to the group. */
  feedingRules: FeedingRule[];
  /** Status of the feeding-rules load. */
  rulesStatus: SourceStatus;
  /** Manual-vs-rule member breakdown once analyzed. */
  breakdown: MemberSourceBreakdown | null;
  /** Status of the (gated) member analysis. */
  memberStatus: SourceStatus;
  /** Error message for whichever step failed. */
  error: string | null;
  /** Open the insight for a group and load its feeding rules. */
  open: (group: GroupSummary) => void;
  /**
   * Run the gated member-source analysis for the open group. Both reads are
   * cache-backed, so a repeat analysis of a group analyzed earlier this session
   * costs no scheduler requests.
   */
  analyzeMembers: () => void;
  /**
   * Recompute the split from a roster that just changed, without touching Okta.
   *
   * `breakdown` is React state, so invalidating the cache after a membership
   * write is not enough on its own — the meter would keep showing pre-mutation
   * counts for as long as the view stayed mounted. Pure recompute, no request.
   * A no-op before any analysis has run.
   */
  resummarize: (members: OktaUser[]) => void;
  /** Close and reset. */
  close: () => void;
}

/**
 * Manage the group-source insight lifecycle for a single group.
 *
 * @param targetTabId - Connected Okta tab id (operations no-op when absent).
 * @returns State plus `open`/`analyzeMembers`/`close` controls.
 */
export function useGroupSource(targetTabId?: number): UseGroupSourceReturn {
  const api = useOktaApi({ targetTabId: targetTabId ?? null });
  const { getGroupRulesForGroup, getAllGroupMembers } = api;

  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [feedingRules, setFeedingRules] = useState<FeedingRule[]>([]);
  const [rulesStatus, setRulesStatus] = useState<SourceStatus>('idle');
  const [breakdown, setBreakdown] = useState<MemberSourceBreakdown | null>(null);
  const [memberStatus, setMemberStatus] = useState<SourceStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Guards a stale async load (reopened for a different group) from writing state.
  const runIdRef = useRef(0);

  /**
   * The rules the last completed analysis classified against, kept so a roster
   * change can be re-summarised without re-fetching anything. `summarizeMemberSources`
   * is pure, so recomputing costs nothing.
   */
  const lastRulesRef = useRef<Parameters<typeof summarizeMemberSources>[2] | null>(null);

  const open = useCallback(
    (nextGroup: GroupSummary) => {
      const runId = ++runIdRef.current;
      setGroup(nextGroup);
      setFeedingRules([]);
      setBreakdown(null);
      setMemberStatus('idle');
      setError(null);
      setRulesStatus('loading');

      getGroupRulesForGroup(nextGroup.id)
        .then((rules) => {
          if (runId !== runIdRef.current) return;
          setFeedingRules(rules.map((r) => ({ id: r.id, name: r.name, status: r.status })));
          setRulesStatus('done');
        })
        .catch((err) => {
          if (runId !== runIdRef.current) return;
          log.error('Failed to load feeding rules:', err);
          setError(err instanceof Error ? err.message : 'Failed to load feeding rules');
          setRulesStatus('error');
        });
    },
    [getGroupRulesForGroup],
  );

  const analyzeMembers = useCallback(() => {
    if (!group) return;
    const runId = runIdRef.current;
    setMemberStatus('loading');
    setError(null);

    // The member walk is the expensive half (`ceil(N/200)` scheduled requests),
    // so it goes through the shared entity cache exactly like every other
    // expensive entity read: a fresh entry is served with no network call, and
    // two analyses started concurrently for the same group coalesce onto one
    // walk. The key and value shape are deliberately identical to
    // `useGroupMembersCache.fetchMembers` and `GroupOverview` — one `OktaUser[]`
    // per group, default 5-minute TTL — so members loaded anywhere in the panel
    // serve this analysis too. Do not give this key a bespoke TTL or shape.
    //
    // Membership mutations now invalidate this key on every write path:
    // `createGroupMemberOperations` reports each successful add/remove to
    // `useOktaApi`, which drops `['groupMembers', groupId]`. The derived
    // `['memberSource', groupId]` breakdown goes with it, because
    // `memberSourceCache` registers it as derived from this key and `invalidate`
    // cascades. The meter above a mutation therefore reflects it immediately
    // rather than holding a pre-mutation count until the TTL lapses.
    Promise.all([
      getOrFetch(cacheKeys.groupMembers(group.id), () => getAllGroupMembers(group.id)),
      getGroupRulesForGroup(group.id),
    ])
      .then(([members, rules]) => {
        if (runId !== runIdRef.current) return;
        lastRulesRef.current = rules;
        const summary = summarizeMemberSources(
          { id: group.id, name: group.name, type: group.type },
          members,
          rules,
        );
        setBreakdown(summary);
        // Bank it for the session: the groups list renders this split in each
        // row's compact meter, and must never pay for it itself.
        writeMemberSource(group.id, summary);
        setMemberStatus('done');
      })
      .catch((err) => {
        if (runId !== runIdRef.current) return;
        log.error('Failed to analyze members:', err);
        setError(err instanceof Error ? err.message : 'Failed to analyze members');
        setMemberStatus('error');
      });
  }, [group, getAllGroupMembers, getGroupRulesForGroup]);

  /**
   * Recompute the split from a roster that just changed, without touching Okta.
   *
   * `breakdown` is React state, so invalidating the *cache* after a membership
   * write is not enough on its own: the meter rendered directly above the Members
   * section would keep showing pre-mutation counts for as long as the view stayed
   * mounted. Since `summarizeMemberSources` is pure and the rules from the last
   * analysis are still in hand, the honest answer is free — no re-walk of the
   * group's members, no extra request.
   *
   * A no-op before any analysis has run: there is no split on screen to correct.
   *
   * @param members - The group's roster after the write.
   */
  const resummarize = useCallback(
    (members: OktaUser[]) => {
      const rules = lastRulesRef.current;
      if (!group || !rules) return;
      const summary = summarizeMemberSources(
        { id: group.id, name: group.name, type: group.type },
        members,
        rules,
      );
      setBreakdown(summary);
      // Keep the banked copy in step, so the groups list's compact meter does not
      // contradict the detail view it was opened from.
      writeMemberSource(group.id, summary);
    },
    [group],
  );

  const close = useCallback(() => {
    runIdRef.current++;
    setGroup(null);
    setFeedingRules([]);
    setRulesStatus('idle');
    setBreakdown(null);
    setMemberStatus('idle');
    setError(null);
    lastRulesRef.current = null;
  }, []);

  return {
    group,
    feedingRules,
    rulesStatus,
    breakdown,
    memberStatus,
    error,
    open,
    analyzeMembers,
    resummarize,
    close,
  };
}
