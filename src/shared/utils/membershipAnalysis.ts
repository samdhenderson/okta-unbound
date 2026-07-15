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
 * Any change to the classification behavior belongs in its own commit with the
 * characterization assertions flipped — do not "improve" it here.
 */

import type { OktaGroup, OktaUser, MembershipRule, GroupMembership } from '../types';
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
 * Classify each of a user's groups as `RULE_BASED` or `DIRECT`.
 *
 * Heuristics, in order:
 * 1. `APP_GROUP`s are always application-managed → `RULE_BASED`.
 * 2. A group with no matching ACTIVE rule → `DIRECT`.
 * 3. A user excluded from EVERY matching ACTIVE rule, yet still in the group →
 *    `DIRECT` (they were added manually despite the rules).
 * 4. Otherwise `RULE_BASED`; the attributed rule is the first non-excluding
 *    ACTIVE match whose referenced user attributes appear in its condition
 *    expression (a coarse confidence check), falling back to the first
 *    non-excluding ACTIVE match.
 *
 * @param groups - The user's groups (raw Okta group objects).
 * @param rules - Candidate group rules to attribute memberships to.
 * @param user - The user whose memberships are being analysed.
 * @returns One {@link GroupMembership} per input group, annotated with its
 *   inferred attribution and (when rule-based) the best-match rule.
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
      };
    }

    // Log if user is excluded from some but not all rules
    if (rulesWithoutExclusion.length < matchingRules.length) {
      const excludedRules = matchingRules.filter((rule) => isUserExcludedFromRule(rule, user.id));
      log.debug(`Group ${group.id}: User excluded from ${excludedRules.length} rule(s)`);
    }

    // Try to evaluate which rule might have added the user
    let bestMatchRule = rulesWithoutExclusion[0];
    let confidence = 'low';

    for (const rule of rulesWithoutExclusion) {
      // Extract user attributes from rule condition
      const condition = rule.conditionExpression || rule.conditions?.expression?.value || '';
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
        bestMatchRule = rule;
        confidence = attributesMatch === attributesChecked ? 'high' : 'medium';
        break;
      }
    }

    log.debug(
      `Group ${group.id}: RULE_BASED (rule: ${bestMatchRule.id}, confidence: ${confidence})`,
    );

    return {
      group: group,
      membershipType: 'RULE_BASED' as const,
      rule: bestMatchRule,
    };
  });
}
