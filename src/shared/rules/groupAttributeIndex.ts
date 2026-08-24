/**
 * @module shared/rules/groupAttributeIndex
 * @description Pure reverse index from a `user.<attr>` reference to the rules
 * that reference it.
 *
 * `extractUserAttributes` ({@link module:shared/ruleUtils}) already pulls the
 * `user.<attr>` references out of a rule's condition expression onto
 * `FormattedRule.userAttributes` (and, since the `FeedingRule` widen in
 * {@link module:sidepanel/hooks/useGroupSource}, onto `FeedingRule.userAttributes`
 * too). What's missing is the reverse lookup: given a group's feeding rules,
 * which of them depend on a given attribute? This module builds that index,
 * the same way {@link module:shared/rules/groupRuleIndex} builds a group-id-keyed
 * one — pure, no API calls, no React — so a caller can intersect it with an
 * attribute-distribution report (`computeAllBreakdowns`) to show only the
 * attributes a group's rules actually depend on.
 *
 * @see {@link indexRulesByAttribute}
 */

/** The fields this module needs off a rule: identity plus the attributes it references. */
export interface AttributeReferencingRule {
  id: string;
  name: string;
  status: string;
  /** The `user.<attr>` references the rule's condition mentions, if any. */
  userAttributes?: string[];
}

/** A rule reduced to what an attribute card needs to link back to it. */
export interface AttributeRuleRef {
  ruleId: string;
  ruleName: string;
}

/**
 * Build a reverse index from attribute name to the rules that reference it.
 *
 * A rule with no `userAttributes` (or an empty array) contributes nothing. A
 * rule referencing the same attribute more than once in its condition still
 * contributes exactly one entry per attribute — `userAttributes` is already
 * deduped per rule by `extractUserAttributes`, and this function dedupes
 * again defensively so a caller-supplied list with repeats can't double-count.
 *
 * @param rules - Rules carrying their referenced `userAttributes`, if any.
 * @returns A map from attribute name to the distinct rules that reference it,
 * in first-seen order. Attributes no rule references are absent from the map.
 */
export function indexRulesByAttribute(
  rules: readonly AttributeReferencingRule[],
): Map<string, AttributeRuleRef[]> {
  const index = new Map<string, AttributeRuleRef[]>();
  for (const rule of rules) {
    // A rule may list the same attribute twice; contribute it once per rule.
    const seen = new Set<string>();
    for (const attribute of rule.userAttributes ?? []) {
      if (seen.has(attribute)) continue;
      seen.add(attribute);
      const refs = index.get(attribute);
      const ref = { ruleId: rule.id, ruleName: rule.name };
      if (refs) {
        refs.push(ref);
      } else {
        index.set(attribute, [ref]);
      }
    }
  }
  return index;
}
