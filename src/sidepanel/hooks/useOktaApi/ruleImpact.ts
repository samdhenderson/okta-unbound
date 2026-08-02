/**
 * @module hooks/useOktaApi/ruleImpact
 * @description Read-only capture of a group rule's access impact.
 *
 * Gathers the raw inputs the pure {@link summarizeRuleImpact} engine needs — the
 * org's rules (with their exclusion lists) and each target group's current
 * members — entirely over the rate-limited scheduler path, then hands off to the
 * engine for the set math. No mutation, and no per-member API calls: the "who
 * loses access" answer comes from rules metadata + the members already fetched.
 */

import type { CoreApi } from './core';
import type { OktaUser, OktaGroupRule, GroupType } from '../../../shared/types';
import { fetchAllPages, OKTA_PAGE_SIZE } from '@/shared/utils/oktaPagination';
import { oktaGroupRuleSchema, type OktaGroupRuleResponse } from '@/shared/schemas/okta';
import { createLogger } from '../../../shared/utils/logger';
import {
  toImpactRule,
  summarizeRuleImpact,
  type TargetGroupMembers,
  type RuleImpactSummary,
} from '../../../shared/membership/ruleImpact';

const log = createLogger('useOktaApi');

/** The subset of a formatted rule the capture needs. */
export interface RuleImpactInput {
  /** Rule id. */
  id: string;
  /** Rule display name. */
  name: string;
  /** Ids of the groups this rule assigns matched users to. */
  groupIds: string[];
  /** Display names for `groupIds`, positionally aligned (optional). */
  groupNames?: string[];
}

/** Options for {@link RuleImpactOperations.captureRuleImpact}. */
export interface CaptureRuleImpactOptions {
  /** Progress callback: `(current, total, message)` as target groups load. */
  onProgress?: (current: number, total: number, message: string) => void;
}

/** The operations this factory returns. */
export interface RuleImpactOperations {
  captureRuleImpact: (
    rule: RuleImpactInput,
    opts?: CaptureRuleImpactOptions,
  ) => Promise<RuleImpactSummary>;
}

/**
 * Build the read-only rule-impact capture operation.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @param getAllGroupMembers - Paginated member fetch (from
 * `createGroupMemberOperations`), reused to read each target group's members.
 * @returns `{ captureRuleImpact }`.
 */
export function createRuleImpactOperations(
  coreApi: CoreApi,
  getAllGroupMembers: (groupId: string) => Promise<OktaUser[]>,
): RuleImpactOperations {
  /**
   * Fetch every group rule (raw, so exclusion lists survive), following `Link`
   * pagination at low priority so it never starves interactive requests.
   */
  const fetchRawRules = async (): Promise<OktaGroupRule[]> => {
    const rules = await fetchAllPages<OktaGroupRuleResponse>(
      (url) => coreApi.makeApiRequest(url, 'GET', undefined, 'low'),
      `/api/v1/groups/rules?limit=${OKTA_PAGE_SIZE}`,
      {
        // Validated at the response boundary (ADR-0006): malformed rows are
        // dropped leniently by parseOktaList, never thrown on.
        schema: oktaGroupRuleSchema,
        errorMessage: 'Failed to fetch group rules',
      },
    );
    // The lenient schema `.passthrough()`es fields it does not declare
    // (`created`, `lastUpdated`, `type`, …), so validated rows still carry the
    // domain type's required audit fields at runtime — hence the widen through
    // `unknown` to the domain `OktaGroupRule` the impact engine consumes.
    return rules as unknown as OktaGroupRule[];
  };

  /** Resolve a target group's display name and type (for APP_GROUP handling). */
  const fetchGroupMeta = async (
    groupId: string,
    fallbackName: string,
  ): Promise<{ name: string; type?: GroupType }> => {
    try {
      const response = await coreApi.makeApiRequest(
        `/api/v1/groups/${groupId}`,
        'GET',
        undefined,
        'low',
      );
      if (response.success && response.data) {
        return {
          name: response.data.profile?.name || fallbackName,
          type: response.data.type as GroupType | undefined,
        };
      }
    } catch (error) {
      log.warn('Failed to fetch group meta for impact preview', { groupId }, error);
    }
    return { name: fallbackName };
  };

  /**
   * Capture the access impact of deactivating `rule`.
   *
   * @param rule - The rule to analyze (id, name, target group ids/names).
   * @param opts - Optional progress callback.
   * @returns A {@link RuleImpactSummary} with per-group and org-level counts.
   * @remarks Cost is one rules listing plus, per target group, one group-meta
   * read and one paginated member fetch — no per-member calls.
   */
  const captureRuleImpact = async (
    rule: RuleImpactInput,
    opts?: CaptureRuleImpactOptions,
  ): Promise<RuleImpactSummary> => {
    const rawRules = await fetchRawRules();
    const impactRules = rawRules.map(toImpactRule);

    const targets: TargetGroupMembers[] = [];
    const total = rule.groupIds.length;

    for (let i = 0; i < total; i++) {
      const groupId = rule.groupIds[i];
      const fallbackName = rule.groupNames?.[i] || groupId;
      opts?.onProgress?.(i + 1, total, `Loading members for ${fallbackName}…`);

      const meta = await fetchGroupMeta(groupId, fallbackName);
      const members = await getAllGroupMembers(groupId);

      targets.push({ groupId, groupName: meta.name, groupType: meta.type, members });
    }

    return summarizeRuleImpact(rule.id, rule.name, targets, impactRules);
  };

  return { captureRuleImpact };
}
