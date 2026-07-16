/**
 * @module shared/rules/groupRuleIndex
 * @description Pure attribution of feeding rules to groups.
 *
 * A group rule "feeds" every group listed in its `assignUserToGroups` target
 * set. This module turns a loaded rule list into a per-group rule tally and
 * uses it to fill in the `hasRules`/`ruleCount` fields on a {@link GroupSummary}
 * — fields the group mapper leaves at their `false`/`0` defaults because the
 * mapper has no visibility into the rules payload. Keeping this pure and
 * separate lets the Groups loader attribute rules from the shared
 * {@link RulesCache} without an extra API call, and keeps the "why does this
 * group exist?" answer (which counts the same feeding rules) consistent with the
 * staleness note.
 *
 * @see {@link countRulesByGroup}
 * @see {@link annotateGroupsWithRuleCounts}
 */

import type { GroupSummary } from '../types';

/** The one field this module needs off a rule: the groups it assigns users to. */
export interface RuleTarget {
  /** Group ids this rule assigns users to (its target/feeding set). */
  groupIds: string[];
}

/**
 * Tally, per group id, how many of the given rules target (feed) it.
 *
 * @param rules - Rules carrying their target `groupIds` (e.g. `FormattedRule`s).
 * @returns A map from group id to the number of rules that feed it. Group ids
 * that no rule targets are absent from the map.
 */
export function countRulesByGroup(rules: readonly RuleTarget[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const rule of rules) {
    // A rule may list the same group twice; count the rule once per group.
    const seen = new Set<string>();
    for (const groupId of rule.groupIds ?? []) {
      if (seen.has(groupId)) continue;
      seen.add(groupId);
      counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Fill in each group's `hasRules`/`ruleCount` from the rules that feed it.
 *
 * Returns a new array of new group objects (never mutates the inputs). A group
 * with no feeding rule gets `hasRules: false`/`ruleCount: 0` — which is only an
 * *accurate* "no rule feeds this" once the caller actually has the rules loaded,
 * so the loader tracks that separately before trusting it as a staleness signal.
 *
 * @param groups - The group summaries to annotate.
 * @param rules - The loaded rules (with target `groupIds`) to attribute.
 * @returns The annotated group summaries.
 */
export function annotateGroupsWithRuleCounts(
  groups: readonly GroupSummary[],
  rules: readonly RuleTarget[],
): GroupSummary[] {
  const counts = countRulesByGroup(rules);
  return groups.map((group) => {
    const ruleCount = counts.get(group.id) ?? 0;
    return { ...group, hasRules: ruleCount > 0, ruleCount };
  });
}
