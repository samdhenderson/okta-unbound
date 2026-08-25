/**
 * @module hooks/useOktaApi/groupDiscovery
 * @description Group discovery and search operations
 */

import type { CoreApi } from './core';
import type { OktaGroup, OktaGroupRule, FormattedRule } from '../../../shared/types';
import { RulesCache } from '../../../shared/rulesCache';
import { detectConflicts, formatRuleForDisplay } from '../../../shared/ruleUtils';
import { fetchAllPages, OKTA_PAGE_SIZE } from '@/shared/utils/oktaPagination';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('useOktaApi');

/**
 * Build read-only group discovery/search operations.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @returns Group listing, member-count, org-wide + per-group rules, search, and
 * by-id lookups.
 */
export function createGroupDiscoveryOperations(coreApi: CoreApi) {
  /**
   * List every group, following `Link` pagination (200 per page, `expand=stats`).
   *
   * @param onProgress - Called after each page with the running loaded count.
   * @returns All groups across all pages.
   * @remarks Throws on the first failed page.
   */
  const getAllGroups = async (
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<OktaGroup[]> =>
    fetchAllPages<OktaGroup>(
      (url) => coreApi.makeApiRequest(url, { reason: 'List all groups' }),
      `/api/v1/groups?limit=${OKTA_PAGE_SIZE}&expand=stats`,
      {
        errorMessage: 'Failed to fetch groups',
        onPage: (_pageGroups, totalSoFar) => onProgress?.(totalSoFar, totalSoFar),
      },
    );

  /**
   * Approximate a group's member count from the first page of members.
   *
   * @param groupId - Group to size.
   * @returns The first-page member count (max 200), or `0` on failure.
   * @remarks Intentionally does NOT walk pagination — for groups larger than one
   * page this returns the page size (200), i.e. a floor, not the exact total.
   */
  const getGroupMemberCount = async (groupId: string): Promise<number> => {
    try {
      const usersResponse = await coreApi.makeApiRequest(
        `/api/v1/groups/${groupId}/users?limit=${OKTA_PAGE_SIZE}`,
        { reason: 'Get group member count' },
      );
      if (usersResponse.success && usersResponse.data) {
        return usersResponse.data.length;
      }

      return 0;
    } catch (error) {
      log.error(`Failed to get member count for group ${groupId}:`, error);
      return 0;
    }
  };

  /**
   * Fetch the org-wide group-rules listing **once** and write it to
   * {@link RulesCache}.
   *
   * @returns The rules in both shapes — `rules` formatted for display and
   * `rawRules` exactly as Okta returned them.
   * @remarks One paginated listing request for the whole org (`Link`-followed,
   * 200 per page), never one request per group. Routed through
   * {@link CoreApi.makeApiRequest}, i.e. the background `ApiScheduler`, like all
   * other Okta traffic. No `currentGroupId` is passed to the formatter: the
   * cache is org-wide, so baking one group's `affectsCurrentGroup` flag into it
   * would be wrong. Throws if a page fails — callers decide whether that is
   * fatal.
   */
  const fetchAndCacheAllGroupRules = async (): Promise<{
    rules: FormattedRule[];
    rawRules: OktaGroupRule[];
  }> => {
    const rawRules = await fetchAllPages<OktaGroupRule>(
      (url) => coreApi.makeApiRequest(url, { reason: 'Load org-wide group rules' }),
      `/api/v1/groups/rules?limit=${OKTA_PAGE_SIZE}`,
    );

    const conflicts = detectConflicts(rawRules);
    const rules = rawRules.map((rule) => formatRuleForDisplay(rule, undefined, conflicts));
    await RulesCache.set(
      rules,
      rawRules,
      {
        total: rawRules.length,
        active: rawRules.filter((r) => r.status === 'ACTIVE').length,
        inactive: rawRules.filter((r) => r.status === 'INACTIVE').length,
        conflicts: conflicts.length,
      },
      conflicts,
    );

    return { rules, rawRules };
  };

  /**
   * Ensure the org-wide rules payload is cached, fetching it once if it is not.
   *
   * Exists for the Groups-tab cold start: without it, a first load with an empty
   * or expired {@link RulesCache} leaves every row's `hasRules`/`ruleCount`
   * reading `0` — indistinguishable from "no rule feeds this group".
   *
   * @returns The cached-or-freshly-fetched display rules, or `null` when the
   * listing could not be loaded (logged, never thrown) so callers can carry on
   * without rule attribution rather than failing the whole load.
   * @remarks Costs at most one paginated rules listing for the entire org — never
   * one request per group. A warm cache costs nothing.
   */
  const ensureGroupRulesLoaded = async (): Promise<FormattedRule[] | null> => {
    try {
      const cached = await RulesCache.get();
      if (cached) return cached.rules;

      log.debug('Rules cache cold - fetching the org-wide rules listing once');
      const { rules } = await fetchAndCacheAllGroupRules();
      return rules;
    } catch (error) {
      log.error('Failed to load the org-wide group rules:', error);
      return null;
    }
  };

  /**
   * Resolve the group rules that assign users to a given group.
   *
   * @param groupId - Group whose inbound assignment rules to find.
   * @returns Matching rules in the {@link FormattedRule} display shape, or `[]`
   * on failure/none.
   * @remarks Serves from {@link RulesCache} when populated or fresh; otherwise
   * fetches the full rules list via {@link fetchAndCacheAllGroupRules} (following
   * `Link` pagination, 200 per page), writing it back to the cache so subsequent
   * lookups — for any group — are served without refetching, and returns the
   * rules targeting `groupId`.
   *
   * **Both paths return the same shape.** The cache-miss path must return the
   * *formatted* rules, not the raw Okta ones: `userAttributes` is not an Okta
   * field, it is synthesised by {@link formatRuleForDisplay}. Returning raw
   * rules here handed every consumer `userAttributes === undefined`, which
   * silently degraded `membershipAnalysis.inferBestMatchRule` to a positional
   * guess on the cold-cache path.
   */
  const getGroupRulesForGroup = async (groupId: string): Promise<FormattedRule[]> => {
    try {
      // Check cache first
      const cachedRules = await RulesCache.getRulesForGroup(groupId);
      if (cachedRules.length > 0 || (await RulesCache.isFresh())) {
        log.debug(`Using cached rules for group ${groupId}:`, cachedRules.length);
        return cachedRules;
      }

      // Cache miss - fetch ALL group rules, following pagination so orgs with
      // more than one page (>200 rules) are not silently truncated.
      log.debug(`Cache miss - fetching all rules for group ${groupId}`);
      const { rules } = await fetchAndCacheAllGroupRules();

      // Filter rules that target this group. On the formatted shape the target
      // ids have already been lifted out of `actions.assignUserToGroups` onto
      // `groupIds` — the same field `RulesCache.getRulesForGroup` filters on, so
      // both paths select identically.
      return rules.filter((rule) => rule.groupIds.includes(groupId));
    } catch (error) {
      log.error(`Failed to get rules for group ${groupId}:`, error);
      return [];
    }
  };

  /**
   * Search groups by name via Okta's `q` query (capped at 20 results).
   *
   * @param query - Search text; queries shorter than 2 chars short-circuit to `[]`.
   * @returns Lightweight `{ id, name, description, type }` records; `[]` on error.
   */
  const searchGroups = async (
    query: string,
  ): Promise<Array<{ id: string; name: string; description: string; type: string }>> => {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      const response = await coreApi.makeApiRequest(
        `/api/v1/groups?q=${encodeURIComponent(query)}&limit=20`,
        { reason: 'Search groups by name' },
      );

      if (response.success && response.data) {
        return response.data.map((group: OktaGroup) => ({
          id: group.id,
          name: group.profile?.name || group.id,
          description: group.profile?.description || '',
          type: group.type || 'OKTA_GROUP',
        }));
      }
      return [];
    } catch (error) {
      log.error('searchGroups error:', error);
      return [];
    }
  };

  /**
   * Fetch one group by id.
   *
   * @param groupId - Group id to look up.
   * @returns A lightweight `{ id, name, description, type }` record, or `null` if
   * not found / on error.
   */
  const getGroupById = async (
    groupId: string,
  ): Promise<{ id: string; name: string; description: string; type: string } | null> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`, {
        reason: 'Fetch group by ID',
      });
      if (response.success && response.data) {
        const group = response.data;
        return {
          id: group.id,
          name: group.profile?.name || group.id,
          description: group.profile?.description || '',
          type: group.type || 'OKTA_GROUP',
        };
      }
      return null;
    } catch (error) {
      log.error('getGroupById error:', error);
      return null;
    }
  };

  return {
    getAllGroups,
    getGroupMemberCount,
    ensureGroupRulesLoaded,
    getGroupRulesForGroup,
    searchGroups,
    getGroupById,
  };
}
