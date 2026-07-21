/**
 * @module sidepanel/hooks/useGroupSource
 * @description Loads the "why does this group exist?" insight for one group.
 *
 * Two tiers, mirroring the MFA scan's cheap-then-gated pattern: opening a group
 * loads its feeding rules (cheap, cache-backed); the manual-vs-rule member split
 * is an opt-in analysis that fetches the group's members (one paginated read) and
 * classifies each with the shared membership heuristic. Read-only.
 */

import { useCallback, useRef, useState } from 'react';
import type { GroupSummary, MembershipRule } from '../../shared/types';
import { useOktaApi } from './useOktaApi';
import {
  summarizeMemberSources,
  type MemberSourceBreakdown,
} from '../../shared/membership/groupSource';
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
  /** Run the gated member-source analysis for the open group. */
  analyzeMembers: () => void;
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
          setFeedingRules(
            (rules as MembershipRule[]).map((r) => ({ id: r.id, name: r.name, status: r.status })),
          );
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

    Promise.all([getAllGroupMembers(group.id), getGroupRulesForGroup(group.id)])
      .then(([members, rules]) => {
        if (runId !== runIdRef.current) return;
        const summary = summarizeMemberSources(
          { id: group.id, name: group.name, type: group.type },
          members,
          rules as MembershipRule[],
        );
        setBreakdown(summary);
        setMemberStatus('done');
      })
      .catch((err) => {
        if (runId !== runIdRef.current) return;
        log.error('Failed to analyze members:', err);
        setError(err instanceof Error ? err.message : 'Failed to analyze members');
        setMemberStatus('error');
      });
  }, [group, getAllGroupMembers, getGroupRulesForGroup]);

  const close = useCallback(() => {
    runIdRef.current++;
    setGroup(null);
    setFeedingRules([]);
    setRulesStatus('idle');
    setBreakdown(null);
    setMemberStatus('idle');
    setError(null);
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
    close,
  };
}
