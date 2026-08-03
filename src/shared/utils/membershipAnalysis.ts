/**
 * @module shared/utils/membershipAnalysis
 * @description Group-membership attribution heuristic — single source of truth.
 *
 * Okta's API does not directly say whether a user was placed in a group by a
 * group rule or added manually, so `analyzeMemberships` infers it. This is the
 * unified, exclusion-aware heuristic shared by `UsersTab` and
 * `hooks/useUserMemberships.ts` (which powers `UserOverview` and the user
 * comparison). It DOES consult rule exclusion lists: a user on the exclusion
 * list of every rule targeting a group is treated as a manual (DIRECT) add.
 * It ALSO evaluates each targeting rule's condition against the user
 * (`shared/ruleEvaluator`): when every condition can be evaluated client-side
 * and none matches, the user must have been added by hand, so the membership is
 * DIRECT. Only when some condition is unevaluable does the legacy heuristic
 * apply, and the result is then flagged `attribution: 'inferred'`.
 * Any change to the classification behavior belongs in its own commit with the
 * characterization assertions flipped — do not "improve" it here.
 */

import type { OktaGroup, OktaUser, MembershipRule, GroupMembership } from '../types';
import { tryEvaluateRuleExpression, type RuleMatchOutcome } from '../ruleEvaluator';
import { createLogger } from './logger';

const log = createLogger('membershipAnalysis');

/**
 * Whether `userId` is explicitly excluded from a rule. Excluded users are not
 * affected by the rule even if they otherwise match its conditions.
 */
function isUserExcludedFromRule(rule: MembershipRule, userId: string): boolean {
  const excludedUsers = rule.conditions?.people?.users?.exclude || [];
  return excludedUsers.includes(userId);
}

/**
 * A rule's condition expression, whichever shape the rule arrived in. Empty
 * when the rule carries no expression at all — which the evaluator reports as
 * `unevaluable`, not as "matches nothing".
 */
function conditionExpressionOf(rule: MembershipRule): string {
  return rule.conditionExpression || rule.conditions?.expression?.value || '';
}

/**
 * Legacy attribution heuristic, used only when at least one targeting rule's
 * condition could not be evaluated. Picks the first rule whose referenced user
 * attributes appear (as a substring, coarsely) in its condition text, falling
 * back to the first non-excluding rule. Known to be imprecise — that is exactly
 * why results derived from it are labelled `inferred`.
 */
function inferBestMatchRule(rules: MembershipRule[], user: OktaUser): MembershipRule {
  for (const rule of rules) {
    const condition = conditionExpressionOf(rule);
    const userAttrs = rule.userAttributes || [];

    // Basic heuristic: check if referenced attributes exist in user profile
    let attributesMatch = 0;
    let attributesChecked = 0;

    for (const attr of userAttrs) {
      attributesChecked++;
      const userValue = (user.profile as Record<string, unknown>)[attr];

      // If attribute exists and is non-empty, it's a potential match
      if (userValue !== undefined && userValue !== null && userValue !== '') {
        // Check if the condition references this attribute value
        const valueStr = String(userValue).toLowerCase();
        const conditionLower = condition.toLowerCase();

        if (conditionLower.includes(valueStr) || conditionLower.includes(`"${valueStr}"`)) {
          attributesMatch++;
        }
      }
    }

    // If we found attribute matches, this rule is more likely
    if (attributesChecked > 0 && attributesMatch >= attributesChecked * 0.5) {
      return rule;
    }
  }

  return rules[0];
}

/**
 * Classify each of a user's groups as `RULE_BASED` or `DIRECT`.
 *
 * Heuristics, in order:
 * 1. `APP_GROUP`s are always application-managed → `RULE_BASED`.
 * 2. A group with no matching ACTIVE rule → `DIRECT`.
 * 3. A user excluded from EVERY matching ACTIVE rule, yet still in the group →
 *    `DIRECT` (they were added manually despite the rules).
 * 4. The user matches a non-excluding ACTIVE rule's condition → `RULE_BASED`,
 *    attributed to THAT rule (`attribution: 'exact'`).
 * 5. Every non-excluding ACTIVE rule's condition was evaluated and none matched
 *    → `DIRECT` (`attribution: 'exact'`) — a manual add into a rule-fed group.
 * 6. Some condition could not be evaluated client-side → `RULE_BASED` via the
 *    legacy coarse heuristic, flagged `attribution: 'inferred'`.
 *
 * Cases 1–5 set `attribution: 'exact'`; only case 6 is a guess.
 *
 * @param groups - The user's groups (raw Okta group objects).
 * @param rules - Candidate group rules to attribute memberships to.
 * @param user - The user whose memberships are being analysed.
 * @returns One {@link GroupMembership} per input group, annotated with its
 *   attribution confidence and (when rule-based) the attributed rule.
 */
export function analyzeMemberships(
  groups: OktaGroup[],
  rules: MembershipRule[],
  user: OktaUser,
): GroupMembership[] {
  log.debug('Analyzing memberships for user:', user.id);
  log.debug(
    'Total rules:',
    rules.length,
    'Active rules:',
    rules.filter((r) => r.status === 'ACTIVE').length,
  );
  log.debug('Total groups:', groups.length);

  return groups.map((group) => {
    // APP_GROUPs are always managed by the application (rule-based)
    if (group.type === 'APP_GROUP') {
      log.debug(`Group ${group.id}: APP_GROUP (application managed)`);
      return {
        group: group,
        membershipType: 'RULE_BASED' as const,
        rule: undefined,
        attribution: 'exact' as const,
      };
    }

    // Find ACTIVE rules that assign users to this group
    const matchingRules = rules.filter((rule) => {
      if (rule.status !== 'ACTIVE') return false;
      const groupIds = rule.groupIds || rule.actions?.assignUserToGroups?.groupIds || [];
      return groupIds.includes(group.id);
    });

    log.debug(`Group ${group.id}: Found ${matchingRules.length} active rules`);

    if (matchingRules.length === 0) {
      // No active rules for this group - must be direct assignment
      log.debug(`Group ${group.id}: DIRECT (no active rules)`);
      return {
        group: group,
        membershipType: 'DIRECT' as const,
        rule: undefined,
        attribution: 'exact' as const,
      };
    }

    // Check if user is excluded from ALL rules for this group.
    // Excluded from every matching rule but still in the group = manual add.
    const rulesWithoutExclusion = matchingRules.filter(
      (rule) => !isUserExcludedFromRule(rule, user.id),
    );

    if (rulesWithoutExclusion.length === 0) {
      log.debug(`Group ${group.id}: DIRECT (user excluded from all ${matchingRules.length} rules)`);
      return {
        group: group,
        membershipType: 'DIRECT' as const,
        rule: undefined,
        attribution: 'exact' as const,
      };
    }

    // Log if user is excluded from some but not all rules
    if (rulesWithoutExclusion.length < matchingRules.length) {
      const excludedRules = matchingRules.filter((rule) => isUserExcludedFromRule(rule, user.id));
      log.debug(`Group ${group.id}: User excluded from ${excludedRules.length} rule(s)`);
    }

    // Ask each candidate rule whether the user actually satisfies its condition.
    // `unevaluable` is deliberately distinct from `no-match`: concluding "not
    // rule-managed" from an expression we failed to parse would be a new,
    // confidently wrong answer.
    const outcomes = rulesWithoutExclusion.map((rule): [MembershipRule, RuleMatchOutcome] => [
      rule,
      tryEvaluateRuleExpression(conditionExpressionOf(rule), user),
    ]);

    const matched = outcomes.find(([, outcome]) => outcome === 'match');
    if (matched) {
      const [rule] = matched;
      log.debug(`Group ${group.id}: RULE_BASED (rule: ${rule.id}, attribution: exact)`);
      return {
        group: group,
        membershipType: 'RULE_BASED' as const,
        rule,
        attribution: 'exact' as const,
      };
    }

    const anyUnevaluable = outcomes.some(([, outcome]) => outcome === 'unevaluable');
    if (!anyUnevaluable) {
      // Every rule that could have fed this group was fully evaluated and none
      // of them matches this user — so they were added by hand.
      log.debug(`Group ${group.id}: DIRECT (no rule condition matches; attribution: exact)`);
      return {
        group: group,
        membershipType: 'DIRECT' as const,
        rule: undefined,
        attribution: 'exact' as const,
      };
    }

    // At least one condition is outside the client-side subset. Fall back to the
    // legacy heuristic and mark the answer as a guess.
    const bestMatchRule = inferBestMatchRule(rulesWithoutExclusion, user);
    log.debug(`Group ${group.id}: RULE_BASED (rule: ${bestMatchRule.id}, attribution: inferred)`);

    return {
      group: group,
      membershipType: 'RULE_BASED' as const,
      rule: bestMatchRule,
      attribution: 'inferred' as const,
    };
  });
}
