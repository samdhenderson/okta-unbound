/**
 * @module shared/ruleUtils
 * @description Pure helpers for analysing, comparing, formatting, and filtering
 * Okta group rules.
 *
 * Extracts the user attributes a rule references, detects conflicts between rules
 * that target shared groups on overlapping attributes, shapes raw rules into the
 * {@link FormattedRule} display model, and provides search/relative-time helpers.
 * All functions are side-effect free.
 *
 * @see {@link detectConflicts}
 * @see {@link formatRuleForDisplay}
 */
import type { OktaGroupRule, RuleConflict, FormattedRule, GroupRuleStatus } from '../shared/types';

/**
 * Read a rule's condition expression as a string, or `''` when it does not have
 * one this extension can work with.
 *
 * `conditions.expression.value` is typed `string` on {@link OktaGroupRule}, but
 * the type is a *claim about* an Okta response, not a check of one — and the
 * field is end-user-controllable (`docs/security.md`). The helpers below are
 * exported and take a bare {@link OktaGroupRule}, so nothing in their signature
 * requires a caller to have parsed that row at a zod boundary; the guard holds
 * regardless of who calls, rather than resting on an audit of today's callers
 * (D-055, D-088). Every rules path in `src/` does validate as of D-065, which
 * makes the guard belt-and-braces — not removable.
 *
 * Every caller formats a whole page inside a `.map`, so an unguarded string
 * operation on one malformed row throws out of the map and costs the entire
 * rules surface. A non-string value therefore degrades to the same "no
 * expression" state a missing one already produces — one field lost, never a
 * thrown error (`CONVENTIONS.md`, "never throw on a missing selector").
 *
 * Exported so the one other place that reads the same field —
 * `fetchGroupRulesRequest`'s `groupIdsReferencedBy`, which scans it for embedded
 * group ids — shares this guard instead of carrying a fourth copy of it (D-066).
 *
 * @param rule - The rule whose condition expression to read.
 * @returns The expression text, or `''` when it is absent or not a string.
 */
export function expressionText(rule: OktaGroupRule): string {
  const value: unknown = rule.conditions?.expression?.value;
  return typeof value === 'string' ? value : '';
}

/**
 * The user ids a rule explicitly excludes, read defensively for the same reason
 * {@link expressionText} is: `conditions.people.users.exclude` is typed
 * `string[]` on {@link OktaGroupRule}, but the type is a claim about an Okta
 * response rather than a check of one, and not every caller formats rules that
 * came through a zod boundary.
 *
 * A non-array, or an array holding anything other than strings, degrades to the
 * rows that *are* strings — never a throw out of the caller's `.map`, which
 * would cost the whole rules surface for one bad row.
 *
 * @param rule - The rule whose exclusion list to read.
 * @returns The excluded user ids, possibly empty.
 */
function excludedUserIdsOf(rule: OktaGroupRule): string[] {
  const value: unknown = rule.conditions?.people?.users?.exclude;
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

/**
 * Extract user attributes from rule expression
 * e.g., "user.department == 'Engineering'" -> ["department"]
 */
export function extractUserAttributes(rule: OktaGroupRule): string[] {
  const attributes = new Set<string>();
  const expression = expressionText(rule);

  // Parse patterns like user.department, user.title, etc.
  const matches = expression.match(/user\.(\w+)/g) || [];
  matches.forEach((match) => {
    const attr = match.replace('user.', '');
    attributes.add(attr);
  });

  return Array.from(attributes);
}

/**
 * Check if two rules assign to the same group(s)
 */
export function assignToSameGroups(rule1: OktaGroupRule, rule2: OktaGroupRule): string[] {
  const groups1 = rule1.actions?.assignUserToGroups?.groupIds || [];
  const groups2 = rule2.actions?.assignUserToGroups?.groupIds || [];

  return groups1.filter((g) => groups2.includes(g));
}

/**
 * Check if two rules have overlapping user attribute conditions
 */
export function checkRuleOverlap(rule1: OktaGroupRule, rule2: OktaGroupRule): RuleConflict | null {
  // Only check active rules
  if (rule1.status !== 'ACTIVE' || rule2.status !== 'ACTIVE') {
    return null;
  }

  const sharedGroups = assignToSameGroups(rule1, rule2);
  if (sharedGroups.length === 0) {
    return null;
  }

  const attrs1 = extractUserAttributes(rule1);
  const attrs2 = extractUserAttributes(rule2);
  const commonAttrs = attrs1.filter((a) => attrs2.includes(a));

  if (commonAttrs.length > 0) {
    return {
      rule1: {
        id: rule1.id,
        name: rule1.name,
      },
      rule2: {
        id: rule2.id,
        name: rule2.name,
      },
      reason: `Both rules use ${commonAttrs.join(', ')} and assign to ${sharedGroups.length} shared group(s)`,
      severity: sharedGroups.length > 2 ? 'high' : sharedGroups.length > 1 ? 'medium' : 'low',
      affectedGroups: sharedGroups,
    };
  }

  return null;
}

/**
 * Detect all conflicts between rules
 */
export function detectConflicts(rules: OktaGroupRule[]): RuleConflict[] {
  const conflicts: RuleConflict[] = [];

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const conflict = checkRuleOverlap(rules[i], rules[j]);
      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }

  return conflicts;
}

/**
 * Format a raw rule into the {@link FormattedRule} display model: simplified
 * condition text, extracted attributes, and any conflicts involving the rule.
 *
 * @param rule - The raw Okta group rule to format.
 * @param currentGroupId - When provided, flags whether the rule targets this group.
 * @param conflicts - Pre-computed conflicts to attribute back to this rule.
 * @remarks Carries the rule's exclusion list forward as
 * {@link FormattedRule.excludedUserIds}: this shape is the only one the
 * user-path membership classifier ever sees, so an exclusion dropped here is an
 * excluded user attributed to the rule that excludes them (D-048).
 * @remarks Never throws on a malformed condition expression. A
 * `conditions.expression.value` that is not a string — which an unvalidated
 * caller can hand over, since the field is end-user-controllable — degrades to
 * the same `'No condition specified'` display a missing expression produces,
 * with no extracted attributes. Callers format whole pages in a `.map`, so a
 * throw here would cost the entire rules surface for one bad row (D-055).
 */
export function formatRuleForDisplay(
  rule: OktaGroupRule,
  currentGroupId?: string,
  conflicts?: RuleConflict[],
): FormattedRule {
  const groupIds = rule.actions?.assignUserToGroups?.groupIds || [];
  const userAttributes = extractUserAttributes(rule);
  const expression = expressionText(rule) || 'No condition specified';

  // Simplify expression for display
  let simpleCondition = expression
    .replace(/user\./g, '')
    .replace(/isMemberOfAnyGroup/g, 'is member of group')
    .replace(/isMemberOfGroup/g, 'is member of group');

  // Check if this rule affects the current group
  const affectsCurrentGroup = currentGroupId ? groupIds.includes(currentGroupId) : false;

  // Find conflicts involving this rule
  const ruleConflicts =
    conflicts?.filter((c) => c.rule1.id === rule.id || c.rule2.id === rule.id) || [];

  return {
    id: rule.id,
    name: rule.name,
    status: rule.status,
    condition: simpleCondition,
    conditionExpression: expression,
    groupIds,
    userAttributes,
    excludedUserIds: excludedUserIdsOf(rule),
    created: rule.created,
    lastUpdated: rule.lastUpdated,
    affectsCurrentGroup,
    conflicts: ruleConflicts,
  };
}

/**
 * Render an ISO-8601 timestamp as a coarse relative-time string
 * (e.g. `"just now"`, `"3 hours ago"`, `"2 months ago"`).
 *
 * @param isoString - An ISO-8601 date string.
 */
export function timeAgo(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
}

/**
 * Filter rules by search query
 */
export function filterRules(rules: FormattedRule[], query: string): FormattedRule[] {
  if (!query || query.trim() === '') {
    return rules;
  }

  const lowerQuery = query.toLowerCase();

  return rules.filter((rule) => {
    return (
      rule.name.toLowerCase().includes(lowerQuery) ||
      rule.id.toLowerCase().includes(lowerQuery) ||
      rule.condition.toLowerCase().includes(lowerQuery) ||
      rule.conditionExpression?.toLowerCase().includes(lowerQuery) ||
      rule.userAttributes.some((attr) => attr.toLowerCase().includes(lowerQuery))
    );
  });
}

/**
 * How a rule's {@link GroupRuleStatus} is marked in a list or a header.
 *
 * Plain data, not JSX, so `shared/` stays free of a `components/` import: the
 * `variant` is a subset of the shared `BadgeVariant` vocabulary and drops
 * straight into `<Badge variant={…}>` with no mapping layer. Status words follow
 * ADR-0002 — `danger`, never `error`.
 */
export interface RuleStatusBadge {
  /** The label to render. */
  text: string;
  /** Badge treatment, from the shared status vocabulary. */
  variant: 'success' | 'neutral' | 'danger';
  /** A one-line explanation, for the badge's `title`. */
  title: string;
}

/**
 * Mark a rule's lifecycle status.
 *
 * The switch is exhaustive over {@link GroupRuleStatus} on purpose (D-085): the
 * old `status === 'ACTIVE' ? success : neutral` ternary rendered `INVALID` as an
 * `INACTIVE` lookalike, which reads as "an admin paused this" when what Okta is
 * actually reporting is "this rule no longer evaluates". `INVALID` therefore
 * gets its own `danger` **Broken** mark, visibly distinct from a pause. Adding a
 * fourth status to the union makes this a compile error rather than a silent
 * default — which is the point.
 *
 * @param status - The rule's status exactly as Okta reported it.
 * @returns The label, treatment and tooltip for the status mark.
 */
export function ruleStatusBadge(status: GroupRuleStatus): RuleStatusBadge {
  switch (status) {
    case 'ACTIVE':
      return { text: 'ACTIVE', variant: 'success', title: 'This rule is in force.' };
    case 'INACTIVE':
      return {
        text: 'INACTIVE',
        variant: 'neutral',
        title:
          'This rule is deactivated, so it places nobody. Members it placed before remain in the group.',
      };
    case 'INVALID':
      return {
        text: 'Broken',
        variant: 'danger',
        title:
          'Okta reports this rule as INVALID: it can no longer be evaluated — usually because a group it references was deleted — so it places nobody.',
      };
  }
}
