/**
 * @module hooks/useOktaApi/ruleWrites
 * @description Group-rule write operations for consolidation (Feature A4).
 *
 * Create / read-raw / delete / (de)activate group rules, all through the
 * rate-limited scheduler path (following the `suspendUser` pattern). Responses
 * from the create/read paths are validated with zod at the boundary (ADR-0006)
 * so a shape change surfaces as a clear error rather than a bad write downstream.
 *
 * ## This layer is transport **plus one cache effect** (ADR-0064)
 *
 * It used to be pure transport over {@link CoreApi}, and its doc said so. It is
 * not any more, deliberately: **every operation here that changes a rule in Okta
 * drops the org-wide {@link RulesCache} entry**, so a caller cannot forget. That
 * cache is a single global `chrome.storage.local` slot holding a 5-minute TTL
 * snapshot of the whole rule inventory, and it is wrong the instant any rule is
 * created, deleted, activated or deactivated — the invariant is a property of
 * the write, not of any one caller's flow. Three hooks were re-deriving it and
 * two of them got it wrong (`D-089`, `D-095`), which is the argument ADR-0064
 * records for putting the effect here rather than above.
 *
 * Two consequences worth knowing before adding an operation:
 *
 * - **A read never invalidates.** `getRawGroupRule` is a `GET` and leaves the
 *   entry alone.
 * - **Invalidation follows the *write*, not the returned result.** A create
 *   whose response fails zod validation returns `success: false`, but the rule
 *   exists in Okta, so the snapshot is dropped anyway. A write the transport
 *   rejected changed nothing and drops nothing.
 */

import type { CoreApi } from './core';
import type { OktaGroupRule } from '../../../shared/types';
import { oktaGroupRuleSchema, parseOkta } from '../../../shared/schemas/okta';
import type { CreateRulePayload } from '../../../shared/rules/consolidation';
import { RulesCache } from '../../../shared/rulesCache';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('useOktaApi');

/** Result of a rule write. */
export interface RuleWriteResult {
  success: boolean;
  error?: string;
}

/** Result of creating a rule (carries the created rule on success). */
export interface CreateRuleResult extends RuleWriteResult {
  rule?: OktaGroupRule;
}

/** The operations this factory returns. */
export interface RuleWriteOperations {
  getRawGroupRule: (ruleId: string) => Promise<OktaGroupRule | null>;
  createGroupRule: (payload: CreateRulePayload) => Promise<CreateRuleResult>;
  deleteGroupRule: (ruleId: string) => Promise<RuleWriteResult>;
  activateGroupRule: (ruleId: string) => Promise<RuleWriteResult>;
  deactivateGroupRule: (ruleId: string) => Promise<RuleWriteResult>;
}

/**
 * Drop the org-wide rule snapshot after a write that landed in Okta.
 *
 * Never lets a cache problem turn a successful write into a failed one:
 * `RulesCache.clear` reports its own storage failures and resolves, but a
 * rejection here would otherwise propagate out of the write and be read by the
 * caller as "the rule was not created". A stale snapshot is the lesser fault,
 * and it expires on its own within the TTL.
 */
async function invalidateRuleSnapshot(): Promise<void> {
  try {
    await RulesCache.clear();
  } catch (err) {
    log.error('Failed to invalidate the rules cache after a write', err);
  }
}

/**
 * Build the group-rule write operations.
 *
 * Every returned operation that mutates a rule also invalidates the org-wide
 * {@link RulesCache} when the write reached Okta — see the module note and
 * ADR-0064.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @returns Create/read/delete/(de)activate rule operations.
 */
export function createRuleWriteOperations(coreApi: CoreApi): RuleWriteOperations {
  /**
   * Fetch one rule in its raw form (conditions + actions intact), so a consolidated
   * copy preserves the exact expression and people include/exclude lists.
   *
   * A read: it never invalidates the snapshot.
   */
  const getRawGroupRule = async (ruleId: string): Promise<OktaGroupRule | null> => {
    const response = await coreApi.makeApiRequest(`/api/v1/groups/rules/${ruleId}`, {
      reason: 'Fetch raw group rule for consolidation',
    });
    if (!response.success || !response.data) return null;
    try {
      return parseOkta(
        oktaGroupRuleSchema,
        response.data,
        'GET /api/v1/groups/rules/{id}',
      ) as unknown as OktaGroupRule;
    } catch (err) {
      log.error('Rule response failed validation', err);
      return null;
    }
  };

  /**
   * Create a group rule; the rule is created `INACTIVE`.
   *
   * Invalidates the snapshot as soon as the `POST` succeeds — including when the
   * created-rule response then fails validation, because the rule exists either
   * way and a caller that aborts after this point (the consolidation flow's
   * activate step, `D-089`) must not leave a rule-short snapshot behind.
   */
  const createGroupRule = async (payload: CreateRulePayload): Promise<CreateRuleResult> => {
    const response = await coreApi.makeApiRequest('/api/v1/groups/rules', {
      method: 'POST',
      body: payload,
      reason: 'Create consolidated group rule',
    });
    if (!response.success) {
      return { success: false, error: response.error || 'Failed to create rule' };
    }
    await invalidateRuleSnapshot();
    try {
      const rule = parseOkta(
        oktaGroupRuleSchema,
        response.data,
        'POST /api/v1/groups/rules',
      ) as unknown as OktaGroupRule;
      return { success: true, rule };
    } catch (err) {
      log.error('Created-rule response failed validation', err);
      return { success: false, error: 'Created rule response was not in the expected shape' };
    }
  };

  /** Delete a group rule (Okta requires it to be `INACTIVE`). Invalidates on success. */
  const deleteGroupRule = async (ruleId: string): Promise<RuleWriteResult> => {
    const response = await coreApi.makeApiRequest(`/api/v1/groups/rules/${ruleId}`, {
      method: 'DELETE',
      reason: 'Delete group rule',
    });
    if (!response.success) return { success: false, error: response.error };
    await invalidateRuleSnapshot();
    return { success: true };
  };

  /** Activate a group rule. Invalidates on success (status + the active/inactive totals). */
  const activateGroupRule = async (ruleId: string): Promise<RuleWriteResult> => {
    const response = await coreApi.makeApiRequest(
      `/api/v1/groups/rules/${ruleId}/lifecycle/activate`,
      { method: 'POST', reason: 'Activate group rule' },
    );
    if (!response.success) return { success: false, error: response.error };
    await invalidateRuleSnapshot();
    return { success: true };
  };

  /** Deactivate a group rule. Invalidates on success (status + the totals). */
  const deactivateGroupRule = async (ruleId: string): Promise<RuleWriteResult> => {
    const response = await coreApi.makeApiRequest(
      `/api/v1/groups/rules/${ruleId}/lifecycle/deactivate`,
      { method: 'POST', reason: 'Deactivate group rule' },
    );
    if (!response.success) return { success: false, error: response.error };
    await invalidateRuleSnapshot();
    return { success: true };
  };

  return {
    getRawGroupRule,
    createGroupRule,
    deleteGroupRule,
    activateGroupRule,
    deactivateGroupRule,
  };
}
