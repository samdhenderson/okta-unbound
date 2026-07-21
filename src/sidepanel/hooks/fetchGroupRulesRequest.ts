/**
 * @module sidepanel/hooks/fetchGroupRulesRequest
 * @description Scheduler-routed fetch of all group rules with names + conflicts.
 *
 * §8: reproduces the content script's former `fetchGroupRules` handler in the side
 * panel, issuing every fetch through the rate-limited scheduler (`makeApiRequest`)
 * instead of a direct `chrome.tabs.sendMessage`. The four-stage pipeline is ported
 * verbatim from `content/ruleHandlers.ts`:
 *   1. paginate `/api/v1/groups/rules?limit=200` (follow `Link` rel="next");
 *   2. resolve every referenced group's name in parallel, cached 5 min per group;
 *   3. detect attribute/target conflicts between active rules (O(n²));
 *   4. format each rule for display (names, `allGroupNamesMap`, conflicts).
 * The `{ success, rules, stats, conflicts }` **top-level** result shape (not under
 * `data`) is preserved so consumers change only their transport line.
 */

import type { OktaGroupRule, FormattedRule, RuleConflict, RuleStats } from '../../shared/types';
import type { CoreApi } from './useOktaApi/core';
import { getCacheEntry, setCacheEntry } from '../../shared/cache';
import { detectConflicts, formatRuleForDisplay } from '../../shared/ruleUtils';
import { nextPageUrl } from './useOktaApi/utilities';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('fetchGroupRulesRequest');

/** The scheduler-routed request function (`useOktaApi().makeApiRequest`). */
type MakeApiRequest = CoreApi['makeApiRequest'];

/** Result of {@link fetchGroupRulesRequest}, mirroring the old content-script response. */
export interface FetchGroupRulesResult {
  success: boolean;
  rules?: FormattedRule[];
  stats?: RuleStats;
  conflicts?: RuleConflict[];
  error?: string;
}

/** Matches an Okta group id embedded in a rule condition expression. */
const GROUP_ID_IN_EXPRESSION = /\b00g[a-zA-Z0-9]{17}\b/g;

/**
 * Collect every group id a rule references — both its assignment targets and any
 * group ids embedded in its condition expression.
 */
function groupIdsReferencedBy(rule: OktaGroupRule): string[] {
  const ids = rule.actions?.assignUserToGroups?.groupIds || [];
  const expression = rule.conditions?.expression?.value || '';
  const inExpression = expression.match(GROUP_ID_IN_EXPRESSION) || [];
  return [...ids, ...inExpression];
}

/**
 * Resolve a single group's display name, served from a 5-minute cache when warm and
 * otherwise fetched by id. Returns `null` when the name cannot be resolved.
 */
async function resolveGroupName(
  makeApiRequest: MakeApiRequest,
  groupId: string,
): Promise<{ groupId: string; name: string } | null> {
  try {
    const cacheKey = `group_name_${groupId}`;
    const cachedName = await getCacheEntry<string>(cacheKey);
    if (cachedName) {
      return { groupId, name: cachedName };
    }

    const groupResponse = await makeApiRequest(`/api/v1/groups/${groupId}`);
    if (groupResponse.success && groupResponse.data?.profile?.name) {
      const groupName = groupResponse.data.profile.name;
      await setCacheEntry(cacheKey, groupName, { ttl: 5 * 60 * 1000 });
      return { groupId, name: groupName };
    }
  } catch (err) {
    log.warn('Failed to fetch group name for group', { groupId }, err);
  }
  return null;
}

/**
 * Fetch every group rule through the scheduler, resolve referenced group names,
 * detect conflicts, and return display-formatted rules plus aggregate stats — the
 * exact behavior of the old content-script `fetchGroupRules` handler.
 *
 * @param makeApiRequest - `useOktaApi().makeApiRequest`, routing via the background scheduler.
 * @param currentGroupId - When provided, flags rules that target this group
 *   (`affectsCurrentGroup`); the caller supplies the panel's current group, which
 *   mirrors the page-URL group the content script used to derive.
 * @param options - `resolveGroupNames` (default `true`) controls step 2. Set it to
 *   `false` for callers that only need raw rule ids/expressions (e.g. membership
 *   analysis, which never reads a resolved name): it skips the per-referenced-group
 *   `GET /api/v1/groups/{id}` fan-out — otherwise hundreds of requests on a cold
 *   cache — and leaves `groupNames`/`allGroupNamesMap` falling back to ids.
 * @returns `{ success: true, rules, stats, conflicts }`; a failed rules page is
 *   returned verbatim, and a thrown error becomes `{ success: false, error }`.
 */
export async function fetchGroupRulesRequest(
  makeApiRequest: MakeApiRequest,
  currentGroupId?: string,
  options: { resolveGroupNames?: boolean } = {},
): Promise<FetchGroupRulesResult> {
  const { resolveGroupNames = true } = options;
  try {
    // 1. Fetch all rules with pagination.
    let rules: OktaGroupRule[] = [];
    let nextUrl: string | null = '/api/v1/groups/rules?limit=200';

    while (nextUrl) {
      const response = await makeApiRequest(nextUrl);
      if (!response.success) {
        return response;
      }
      const page: OktaGroupRule[] = response.data || [];
      rules = rules.concat(page);
      nextUrl = nextPageUrl(nextUrl, response.headers?.link, page.length);
    }

    log.debug('Fetched rules (total across all pages)', { count: rules.length });

    // 2. Resolve every referenced group's name in parallel (each cached 5 min).
    //    Skipped when the caller only needs ids/expressions — the fan-out is one
    //    GET per referenced group and is pure waste for those callers.
    const groupNameMap = new Map<string, string>();
    if (resolveGroupNames) {
      const allGroupIds = new Set<string>();
      rules.forEach((rule) => groupIdsReferencedBy(rule).forEach((id) => allGroupIds.add(id)));

      const resolved = await Promise.all(
        Array.from(allGroupIds).map((groupId) => resolveGroupName(makeApiRequest, groupId)),
      );
      resolved.forEach((result) => {
        if (result) groupNameMap.set(result.groupId, result.name);
      });
    }

    // 3. Detect conflicts between active rules (O(n²), active-only).
    const conflicts = detectConflicts(rules);

    // 4. Format each rule for display, layering on the resolved group names.
    const formattedRules: FormattedRule[] = rules.map((rule) => {
      const base = formatRuleForDisplay(rule, currentGroupId, conflicts);
      const groupNames = base.groupIds.map((id) => groupNameMap.get(id) || id);

      // Map of ALL referenced group ids (targets + condition) → resolved names.
      const allGroupNamesMap: Record<string, string> = {};
      new Set(groupIdsReferencedBy(rule)).forEach((id) => {
        const name = groupNameMap.get(id);
        if (name) allGroupNamesMap[id] = name;
      });

      return { ...base, groupNames, allGroupNamesMap };
    });

    const activeCount = rules.filter((r) => r.status === 'ACTIVE').length;
    const stats: RuleStats = {
      total: rules.length,
      active: activeCount,
      inactive: rules.filter((r) => r.status === 'INACTIVE').length,
      conflicts: conflicts.length,
    };

    log.debug('Rule stats', stats);
    return { success: true, rules: formattedRules, stats, conflicts };
  } catch (error) {
    log.error('fetchGroupRules error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch rules',
    };
  }
}
