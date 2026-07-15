/**
 * @module shared/rules/consolidation
 * @description Pure helpers for group-rule consolidation (Feature A4).
 *
 * Okta only lets you set a rule's target groups at **creation**, not on edit. So
 * "add a target group" is really "create a replacement rule carrying the union of
 * target groups, then retire the original". These helpers build that replacement
 * payload and detect rules that are safe to merge (identical match expressions).
 * All pure — the write sequencing/audit lives in the hook.
 *
 * @see {@link buildConsolidatedRulePayload}
 * @see {@link findMergeableRuleGroups}
 */

import type { OktaGroupRule } from '../types';

/** The `POST /api/v1/groups/rules` body for a consolidated rule. */
export interface CreateRulePayload {
  type: string;
  name: string;
  conditions: OktaGroupRule['conditions'];
  actions: { assignUserToGroups: { groupIds: string[] } };
}

/** Suffix appended to a consolidated rule's name (Okta rule names must be unique). */
export const CONSOLIDATED_SUFFIX = ' (consolidated)';

/** Okta caps rule names at 50 chars; keep the suffix and truncate the base. */
const MAX_RULE_NAME = 50;

/**
 * Derive the name for a consolidated rule: the base name plus a suffix, truncated
 * to Okta's 50-char limit. Exposed so the UI can preview the exact resulting name.
 *
 * @param baseName - The original rule's name.
 * @returns A unique, length-capped consolidated name.
 */
export function consolidatedRuleName(baseName: string): string {
  const room = MAX_RULE_NAME - CONSOLIDATED_SUFFIX.length;
  const base = baseName.length > room ? baseName.slice(0, room) : baseName;
  return `${base}${CONSOLIDATED_SUFFIX}`;
}

/**
 * Compute the union of a rule's current target groups with additional group ids
 * (order-preserving, de-duplicated).
 *
 * @param rule - The source rule.
 * @param addGroupIds - Group ids to add.
 * @returns The resulting target group id list.
 */
export function unionTargetGroups(rule: OktaGroupRule, addGroupIds: string[]): string[] {
  const current = rule.actions?.assignUserToGroups?.groupIds ?? [];
  const seen = new Set(current);
  const result = [...current];
  for (const id of addGroupIds) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/**
 * Build the create-rule payload for a consolidated rule: the source rule's
 * expression and people conditions, a unique consolidated name, and the union of
 * its target groups with the added ones.
 *
 * @param rule - The raw source rule (its conditions are copied verbatim).
 * @param addGroupIds - Group ids to add to the target set.
 * @returns The `POST /api/v1/groups/rules` body.
 */
export function buildConsolidatedRulePayload(
  rule: OktaGroupRule,
  addGroupIds: string[],
): CreateRulePayload {
  return {
    type: rule.type || 'group_rule',
    name: consolidatedRuleName(rule.name),
    conditions: rule.conditions,
    actions: { assignUserToGroups: { groupIds: unionTargetGroups(rule, addGroupIds) } },
  };
}

/** Normalize a rule's match expression for equality comparison. */
export function normalizeExpression(rule: OktaGroupRule): string {
  return (rule.conditions?.expression?.value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** A set of rules that share an identical match expression. */
export interface MergeableRuleGroup {
  /** The shared normalized expression. */
  expression: string;
  /** The rules sharing it (2+). */
  rules: OktaGroupRule[];
  /** Union of every member rule's target groups. */
  unionGroupIds: string[];
}

/**
 * Group rules by identical (whitespace/case-normalized) match expression, keeping
 * only groups of 2+ — these are safe to merge into one rule carrying the union of
 * their target groups. Rules with an empty expression are ignored.
 *
 * @param rules - All group rules to scan.
 * @returns One {@link MergeableRuleGroup} per multi-rule expression cluster.
 */
export function findMergeableRuleGroups(rules: OktaGroupRule[]): MergeableRuleGroup[] {
  const byExpression = new Map<string, OktaGroupRule[]>();
  for (const rule of rules) {
    const key = normalizeExpression(rule);
    if (!key) continue;
    const bucket = byExpression.get(key);
    if (bucket) bucket.push(rule);
    else byExpression.set(key, [rule]);
  }

  const groups: MergeableRuleGroup[] = [];
  for (const [expression, clusterRules] of byExpression) {
    if (clusterRules.length < 2) continue;
    const seen = new Set<string>();
    const unionGroupIds: string[] = [];
    for (const rule of clusterRules) {
      for (const id of rule.actions?.assignUserToGroups?.groupIds ?? []) {
        if (!seen.has(id)) {
          seen.add(id);
          unionGroupIds.push(id);
        }
      }
    }
    groups.push({ expression, rules: clusterRules, unionGroupIds });
  }

  return groups;
}
