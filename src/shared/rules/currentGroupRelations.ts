/**
 * @module shared/rules/currentGroupRelations
 * @description The two ways a loaded rule can touch the group open in the Okta tab.
 *
 * A rule relates to a group in one of two opposite directions:
 *
 * - **It assigns members into it** — the group id is in the rule's `assignUserToGroups`
 *   target set, so the rule *feeds* the group.
 * - **It references it by id in a condition** — the group id appears inside an id-taking
 *   membership call, so the group is an *input* and nobody is added here by it.
 *
 * These live here rather than beside the panel that lists them because two surfaces read
 * them — the panel, and the rules strip's *This group (N)* label — and a count that can
 * drift from the list it counts is worse than no count. Keeping the split pure also keeps
 * it testable without rendering anything.
 *
 * **Reference detection is partial by design.** It runs through
 * {@link shared/rules/groupRuleIndex.extractReferencedGroupIds}, which matches the two of
 * Okta's seven membership functions that take group **ids**. The five name-based variants
 * resolve to groups this extension never sees, so a rule matching on name genuinely reads
 * the group and still will not be found here. Any copy built on these numbers has to keep
 * that caveat visible.
 */
import { extractReferencedGroupIds } from './groupRuleIndex';
import type { FormattedRule } from '../types';

/**
 * Split the loaded rules into the two ways they can touch the current group.
 *
 * A rule that both feeds the group and reads it in its condition appears in **both**
 * lists — they are opposite edges of the same graph, not a partition.
 *
 * @param rules - Every rule currently loaded, unfiltered by search or chip.
 * @param currentGroupId - The detected group id, if any. Absent yields two empty lists.
 * @returns The rules that assign into the group, and those that reference it by id.
 */
export const splitCurrentGroupRuleRelations = (
  rules: FormattedRule[],
  currentGroupId?: string,
): { assigning: FormattedRule[]; referencing: FormattedRule[] } => {
  const assigning: FormattedRule[] = [];
  const referencing: FormattedRule[] = [];
  if (!currentGroupId) return { assigning, referencing };
  for (const rule of rules) {
    if (rule.groupIds?.includes(currentGroupId)) assigning.push(rule);
    if (extractReferencedGroupIds(rule.conditionExpression).includes(currentGroupId)) {
      referencing.push(rule);
    }
  }
  return { assigning, referencing };
};

/**
 * How many distinct rules relate to the current group at all — the number the rules
 * strip's *This group* verb carries.
 *
 * The **union**, not the sum. A rule that feeds the group *and* reads it in its condition
 * is listed twice by the panel, once under each heading, but it is one rule; summing the
 * two lists would put a number on the verb that promises more rules than exist.
 *
 * @param rules - Every rule currently loaded, unfiltered.
 * @param currentGroupId - The detected group id, if any.
 * @returns The count of distinct related rules; `0` when no group is detected.
 */
export const countCurrentGroupRuleRelations = (
  rules: FormattedRule[],
  currentGroupId?: string,
): number => {
  const { assigning, referencing } = splitCurrentGroupRuleRelations(rules, currentGroupId);
  return new Set([...assigning, ...referencing].map((r) => r.id)).size;
};
