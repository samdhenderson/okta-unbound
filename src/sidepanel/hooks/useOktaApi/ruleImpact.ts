/**
 * @module hooks/useOktaApi/ruleImpact
 * @description Read-only capture of a group rule's access impact.
 *
 * Gathers the raw inputs the pure {@link summarizeRuleImpact} engine needs — the
 * org's rules (with their exclusion lists) and each target group's current
 * members — from the org snapshot plus the rate-limited scheduler path, then
 * hands off to the engine for the set math. No mutation, and no per-member API
 * calls: the "who loses access" answer comes from rules metadata + the members
 * already fetched.
 */

import type { CoreApi } from './core';
import type { OktaUser, OktaGroupRule, GroupType } from '../../../shared/types';
import { orgSnapshotStore } from '../../../shared/snapshot/orgSnapshotStore';
import { OperationCancelledError } from '../../../shared/scheduler/cancellation';
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
 * @param oktaOrigin - Connected org origin, threaded from the caller because
 * this is an imperative factory rather than a React hook (so it reads
 * `orgSnapshotStore` directly instead of `useOrgSnapshot`). `null`/`undefined`
 * before the origin resolves, which degrades to the paginated fetch rather than
 * reading some other org's rules.
 * @returns `{ captureRuleImpact }`.
 */
export function createRuleImpactOperations(
  coreApi: CoreApi,
  getAllGroupMembers: (groupId: string) => Promise<OktaUser[]>,
  oktaOrigin?: string | null,
): RuleImpactOperations {
  /**
   * Fetch every group rule (raw, so exclusion lists survive), following `Link`
   * pagination at low priority so it never starves interactive requests.
   *
   * @remarks Served from the background-owned org snapshot's `rules` collection
   * (`RULES_SPEC`) when it holds rows for this org, so opening the impact
   * preview does not re-paginate `/api/v1/groups/rules` and cannot disagree with
   * the rule attribution other surfaces derive from the same rows (D-029a). A
   * cold snapshot — or no origin yet — falls through to the fetch below.
   */
  const fetchRawRules = async (): Promise<OktaGroupRule[]> => {
    if (oktaOrigin) {
      // Rows were zod-parsed against `oktaGroupRuleSchema` on write by the
      // snapshot walk (ADR-0006), so this is a read of already-validated data;
      // the widen through `unknown` is the same one the fetch path documents
      // below, for the same passthrough reason.
      const stored = await orgSnapshotStore.getCollection<OktaGroupRuleResponse>(
        'rules',
        oktaOrigin,
      );
      if (stored.length > 0) {
        log.debug('Serving raw rules from the org snapshot', { count: stored.length });
        return stored as unknown as OktaGroupRule[];
      }
    }

    const rules = await fetchAllPages<OktaGroupRuleResponse>(
      (url) =>
        coreApi.makeApiRequest(url, {
          priority: 'low',
          reason: 'List group rules for rule impact preview',
        }),
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
      const response = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`, {
        priority: 'low',
        reason: 'Rule impact preview',
      });
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
   * @remarks Cost is one rules listing (usually free — served from the org
   * snapshot) plus, per target group, one group-meta read and one paginated
   * member fetch — no per-member calls. Target groups load through {@link CoreApi.runOperation}
   * (ADR-0009): cancellable and activity-bar visible. The first failing group
   * aborts the capture with its error re-raised (matching the old serial loop);
   * a cancel raises {@link OperationCancelledError}.
   */
  const captureRuleImpact = async (
    rule: RuleImpactInput,
    opts?: CaptureRuleImpactOptions,
  ): Promise<RuleImpactSummary> => {
    const rawRules = await fetchRawRules();
    const impactRules = rawRules.map(toImpactRule);

    const total = rule.groupIds.length;
    const groupInputs = rule.groupIds.map((groupId, i) => ({
      groupId,
      fallbackName: rule.groupNames?.[i] || groupId,
    }));
    let started = 0;

    const outcome = await coreApi.runOperation(
      'Rule impact preview',
      groupInputs,
      async ({ groupId, fallbackName }): Promise<TargetGroupMembers> => {
        started += 1;
        opts?.onProgress?.(Math.min(started, total), total, `Loading members for ${fallbackName}…`);

        const meta = await fetchGroupMeta(groupId, fallbackName);
        const members = await getAllGroupMembers(groupId);
        return { groupId, groupName: meta.name, groupType: meta.type, members };
      },
      {
        stopOnError: () => true,
        message: (p) => `Loading rule targets (${p.completed}/${p.total})`,
      },
    );

    if (outcome.cancelled) {
      throw new OperationCancelledError();
    }
    const rejected = outcome.results.find((r) => r.status === 'rejected');
    if (rejected) {
      throw rejected.error instanceof Error
        ? rejected.error
        : new Error('Failed to load rule target group');
    }

    // Results preserve input order, so the summary's per-group view is stable.
    const targets: TargetGroupMembers[] = [];
    for (const r of outcome.results) {
      if (r.status === 'fulfilled' && r.value) targets.push(r.value);
    }

    return summarizeRuleImpact(rule.id, rule.name, targets, impactRules);
  };

  return { captureRuleImpact };
}
