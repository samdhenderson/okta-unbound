/**
 * @module hooks/useOktaApi/ruleWrites
 * @description Group-rule write operations for consolidation (Feature A4).
 *
 * Create / read-raw / delete / (de)activate group rules, all through the
 * rate-limited scheduler path (following the `suspendUser` pattern). Responses
 * from the create/read paths are validated with zod at the boundary (ADR-0006)
 * so a shape change surfaces as a clear error rather than a bad write downstream.
 */

import type { CoreApi } from './core';
import type { OktaGroupRule } from '../../../shared/types';
import { oktaGroupRuleSchema, parseOkta } from '../../../shared/schemas/okta';
import type { CreateRulePayload } from '../../../shared/rules/consolidation';
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
 * Build the group-rule write operations.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @returns Create/read/delete/(de)activate rule operations.
 */
export function createRuleWriteOperations(coreApi: CoreApi): RuleWriteOperations {
  /**
   * Fetch one rule in its raw form (conditions + actions intact), so a consolidated
   * copy preserves the exact expression and people include/exclude lists.
   */
  const getRawGroupRule = async (ruleId: string): Promise<OktaGroupRule | null> => {
    const response = await coreApi.makeApiRequest(`/api/v1/groups/rules/${ruleId}`);
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

  /** Create a group rule; the rule is created `INACTIVE`. */
  const createGroupRule = async (payload: CreateRulePayload): Promise<CreateRuleResult> => {
    const response = await coreApi.makeApiRequest('/api/v1/groups/rules', 'POST', payload);
    if (!response.success) {
      return { success: false, error: response.error || 'Failed to create rule' };
    }
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

  /** Delete a group rule (Okta requires it to be `INACTIVE`). */
  const deleteGroupRule = async (ruleId: string): Promise<RuleWriteResult> => {
    const response = await coreApi.makeApiRequest(`/api/v1/groups/rules/${ruleId}`, 'DELETE');
    return { success: response.success, error: response.error };
  };

  /** Activate a group rule. */
  const activateGroupRule = async (ruleId: string): Promise<RuleWriteResult> => {
    const response = await coreApi.makeApiRequest(
      `/api/v1/groups/rules/${ruleId}/lifecycle/activate`,
      'POST',
    );
    return { success: response.success, error: response.error };
  };

  /** Deactivate a group rule. */
  const deactivateGroupRule = async (ruleId: string): Promise<RuleWriteResult> => {
    const response = await coreApi.makeApiRequest(
      `/api/v1/groups/rules/${ruleId}/lifecycle/deactivate`,
      'POST',
    );
    return { success: response.success, error: response.error };
  };

  return {
    getRawGroupRule,
    createGroupRule,
    deleteGroupRule,
    activateGroupRule,
    deactivateGroupRule,
  };
}
