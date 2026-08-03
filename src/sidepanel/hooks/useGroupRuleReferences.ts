/**
 * @module sidepanel/hooks/useGroupRuleReferences
 * @description Loads the rules that *reference* a group in their condition expression.
 *
 * The second, deliberately separate rule axis (see
 * `shared/rules/groupRuleIndex`): a rule can **assign into** a group
 * (`assignUserToGroups`, which {@link sidepanel/hooks/useGroupSource.useGroupSource}
 * already resolves) or merely **consult** it in its condition
 * (`isMemberOfAnyGroup("…")`). Folding the two together is what the groups-list
 * badge got wrong, so the Group Detail view lists them apart and this hook owns
 * the second list.
 *
 * Cost: at most **one org-wide rules listing** via `ensureGroupRulesLoaded` — a
 * warm {@link RulesCache} costs nothing, and it is never one request per group.
 * Read-only.
 */

import { useEffect, useRef, useState } from 'react';
import { useOktaApi } from './useOktaApi';
import { extractReferencedGroupIds } from '../../shared/rules/groupRuleIndex';
import { createLogger } from '../../shared/utils/logger';
import type { SourceStatus } from './useGroupSource';

const log = createLogger('useGroupRuleReferences');

/** A rule that names the group in its condition, reduced to what the view shows. */
export interface ReferencingRule {
  /** Okta rule id, used for the deep link into the Rules tab. */
  id: string;
  /** Rule name. */
  name: string;
  /** `ACTIVE` / `INACTIVE` as returned by Okta. */
  status: string;
  /** The raw condition expression that names this group, when the rule carries one. */
  conditionExpression?: string;
}

/** Return shape of {@link useGroupRuleReferences}. */
export interface UseGroupRuleReferencesReturn {
  /** Rules whose condition expression references the group by id. */
  rules: ReferencingRule[];
  /** Async status of the org-wide rules load backing the list. */
  status: SourceStatus;
  /** Error message when the rules listing could not be loaded. */
  error: string | null;
}

/**
 * Resolve the rules that consult a group in their condition expression.
 *
 * Only id-taking membership functions count — `isMemberOfGroup(...)` and
 * `isMemberOfAnyGroup(...)`. Name-based variants
 * (`isMemberOfGroupName`, `…NameStartsWith`, …) are deliberately **not** matched,
 * because a name can resolve to groups from other sources; UI copy must not claim
 * the list is exhaustive.
 *
 * @param groupId - Group to look up.
 * @param targetTabId - Connected Okta tab id (the load no-ops when absent).
 * @param enabled - Whether the hosting tab is the visible one. The Group Detail
 *   view stays mounted while another top-level tab is selected, and a new
 *   `targetTabId` re-arms the load — so while this is `false` the load is
 *   **deferred, not dropped**, and runs once the view is on screen again.
 *   Defaults to `true`.
 * @returns The referencing rules plus the load status/error.
 */
export function useGroupRuleReferences(
  groupId: string,
  targetTabId?: number,
  enabled = true,
): UseGroupRuleReferencesReturn {
  const api = useOktaApi({ targetTabId: targetTabId ?? null });
  const { ensureGroupRulesLoaded } = api;

  const [rules, setRules] = useState<ReferencingRule[]>([]);
  const [status, setStatus] = useState<SourceStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  // Guards a stale load (the view switched groups mid-flight) from writing state.
  const runIdRef = useRef(0);

  // Reset to the loading state during render when the group changes — the React
  // derive-state-from-props pattern, so the caller never paints one group's rules
  // under another group's heading. Doing it in an effect would both flash the stale
  // list and trip `react-hooks/set-state-in-effect`.
  const [lastGroupId, setLastGroupId] = useState(groupId);
  if (groupId !== lastGroupId) {
    setLastGroupId(groupId);
    setRules([]);
    setStatus('loading');
    setError(null);
  }

  // A load becomes owed whenever the group or the API target changes, and is paid
  // the next time the view is actually visible. Split in two so re-showing the tab
  // does not by itself re-request: the flag is only raised by a real input change.
  const owedRef = useRef(true);
  useEffect(() => {
    owedRef.current = true;
  }, [groupId, ensureGroupRulesLoaded]);

  useEffect(() => {
    if (!enabled || !owedRef.current) return;
    owedRef.current = false;
    const runId = ++runIdRef.current;

    ensureGroupRulesLoaded()
      .then((all) => {
        if (runId !== runIdRef.current) return;
        if (!all) {
          setError('Could not load the org rules, so references to this group are unknown.');
          setStatus('error');
          return;
        }
        setRules(
          all
            .filter((rule) => extractReferencedGroupIds(rule.conditionExpression).includes(groupId))
            .map((rule) => ({
              id: rule.id,
              name: rule.name,
              status: rule.status,
              conditionExpression: rule.conditionExpression,
            })),
        );
        setStatus('done');
      })
      .catch((err) => {
        if (runId !== runIdRef.current) return;
        log.error('Failed to load referencing rules:', err);
        setError(err instanceof Error ? err.message : 'Failed to load referencing rules');
        setStatus('error');
      });
  }, [enabled, groupId, ensureGroupRulesLoaded]);

  return { rules, status, error };
}
