/**
 * @module shared/rules/groupRuleIndex
 * @description Pure attribution of rules to groups, along two distinct axes.
 *
 * A group relates to a rule in one of two ways:
 * - **Assigned by** the rule — the group is in the rule's `assignUserToGroups`
 *   target set, i.e. the rule *feeds* the group. This drives `hasRules`/
 *   `ruleCount` (and, downstream, the "no feeding rule" staleness signal).
 * - **Used in** the rule — the group id appears in the rule's condition
 *   expression (e.g. `isMemberOfAnyGroup("<id>")`), i.e. the group is consulted
 *   to *decide* the rule rather than populated by it. This drives
 *   `usedInRuleCount`.
 *
 * These are deliberately separate: a group referenced in a condition is NOT fed
 * by that rule, so folding the two together would wrongly suppress the orphan
 * staleness signal. This module turns a loaded rule list into per-group tallies
 * for both axes, filling in fields the group mapper leaves at their defaults.
 * Keeping it pure lets the Groups loader attribute rules from the shared
 * {@link RulesCache} without an extra API call.
 *
 * @see {@link countRulesByGroup}
 * @see {@link countReferencedGroups}
 * @see {@link annotateGroupsWithRuleCounts}
 */

import type { GroupSummary } from '../types';

/** The one field this module needs off a rule: the groups it assigns users to. */
export interface RuleTarget {
  /** Group ids this rule assigns users to (its target/feeding set). */
  groupIds: string[];
}

/** A rule reduced to both attribution axes: its targets and its condition text. */
export interface RuleAttribution extends RuleTarget {
  /**
   * The rule's condition expression, if any. Group ids referenced by the
   * id-taking membership functions in it are parsed out as "used in" relations.
   */
  conditionExpression?: string | null;
}

/**
 * Okta condition functions that reference groups **by id** —
 * `isMemberOfGroup(...)` and `isMemberOfAnyGroup(...)`. The trailing `\(`
 * excludes the name/pattern variants (`isMemberOfGroupName(`,
 * `isMemberOfAnyGroupName(`, `…NameStartsWith(`, …), whose arguments are group
 * names, not ids.
 */
const GROUP_ID_FN_RE = /\bisMemberOf(?:Any)?Group\s*\(/g;

/** Read a quoted string literal starting just past the opening quote. */
function readStringLiteral(
  src: string,
  start: number,
  quote: string,
): { value: string; end: number } {
  let value = '';
  let i = start;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\' && i + 1 < src.length) {
      value += src[i + 1];
      i += 2;
      continue;
    }
    if (c === quote) {
      i++;
      break;
    }
    value += c;
    i++;
  }
  return { value, end: i };
}

/**
 * Extract the group ids a condition expression references via its id-taking
 * membership functions. Scans the argument lists quote-aware (rather than
 * substring-matching the raw text) so quoted parentheses/commas can't confuse
 * it; unrelated string literals elsewhere in the expression are ignored.
 *
 * @param expression - A rule's raw condition expression (may be empty/undefined).
 * @returns The distinct referenced group ids, in first-seen order.
 */
export function extractReferencedGroupIds(expression?: string | null): string[] {
  if (!expression) return [];
  const ids = new Set<string>();
  const re = new RegExp(GROUP_ID_FN_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(expression)) !== null) {
    let i = match.index + match[0].length; // first char after the '('
    let depth = 1;
    while (i < expression.length && depth > 0) {
      const ch = expression[i];
      if (ch === '"' || ch === "'") {
        const { value, end } = readStringLiteral(expression, i + 1, ch);
        const id = value.trim();
        if (id) ids.add(id);
        i = end;
        continue;
      }
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      i++;
    }
  }
  return [...ids];
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
 * Tally, per group id, how many of the given rules *reference* it in their
 * condition expression (the "used in" axis — see the module header).
 *
 * @param rules - Rules carrying a `conditionExpression`.
 * @returns A map from group id to the number of rules that reference it. Group
 * ids no rule references are absent from the map.
 */
export function countReferencedGroups(rules: readonly RuleAttribution[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const rule of rules) {
    // extractReferencedGroupIds already dedupes within one expression, so each
    // referenced group is counted at most once per rule.
    for (const groupId of extractReferencedGroupIds(rule.conditionExpression)) {
      counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Fill in each group's rule-attribution fields from a loaded rule list.
 *
 * `hasRules`/`ruleCount` reflect only the **assigned-by** (feeding) rules, so the
 * downstream "no feeding rule" staleness signal stays accurate; `usedInRuleCount`
 * separately reflects the **used-in** (referenced-in-condition) rules. Returns a
 * new array of new group objects (never mutates the inputs). A group with no
 * relation gets `0`s — only an *accurate* "no rule feeds this" once the caller
 * actually has the rules loaded, which the loader tracks separately.
 *
 * @param groups - The group summaries to annotate.
 * @param rules - The loaded rules (target `groupIds` + `conditionExpression`).
 * @returns The annotated group summaries.
 */
export function annotateGroupsWithRuleCounts(
  groups: readonly GroupSummary[],
  rules: readonly RuleAttribution[],
): GroupSummary[] {
  const assignedCounts = countRulesByGroup(rules);
  const referencedCounts = countReferencedGroups(rules);
  return groups.map((group) => {
    const ruleCount = assignedCounts.get(group.id) ?? 0;
    const usedInRuleCount = referencedCounts.get(group.id) ?? 0;
    return { ...group, hasRules: ruleCount > 0, ruleCount, usedInRuleCount };
  });
}
