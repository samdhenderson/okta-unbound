/**
 * @module shared/utils/membershipAnalysis
 * @description Group-membership attribution heuristic for the Users tab.
 *
 * Okta's API does not directly say whether a user was placed in a group by a
 * group rule or added manually, so `analyzeMemberships` infers it. This is the
 * in-file heuristic extracted **verbatim** from `UsersTab`, preserved exactly as
 * it shipped: it does NOT consult rule exclusion lists (a separate, divergent
 * copy in `hooks/useUserMemberships.ts` does). Any change to the classification
 * behavior belongs in its own commit with the characterization assertions
 * flipped — do not "improve" it here.
 */

import type { OktaGroup, OktaUser, MembershipRule, GroupMembership } from '../types';
import { createLogger } from './logger';

const log = createLogger('membershipAnalysis');

/**
 * Classify each of a user's groups as `RULE_BASED` or `DIRECT`.
 *
 * Heuristics, in order:
 * 1. `APP_GROUP`s are always application-managed → `RULE_BASED`.
 * 2. A group with no ACTIVE rule assigning it → `DIRECT`.
 * 3. Otherwise `RULE_BASED`; the attributed rule is the first ACTIVE match whose
 *    referenced user attributes appear in its condition expression (a coarse
 *    confidence check), falling back to the first ACTIVE match.
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

    // Try to evaluate which rule might have added the user
    let bestMatchRule = matchingRules[0];
    let confidence = 'low';

    for (const rule of matchingRules) {
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
