/**
 * @module shared/membership/groupSource
 * @description Pure "why does this group exist?" aggregation.
 *
 * Given a group's current members and the rules that target it, splits the
 * membership into manual (DIRECT) vs rule-managed (RULE_BASED) and tallies how
 * many members each feeding rule accounts for. Delegates the per-member
 * classification to the app's single source of truth
 * (`shared/utils/membershipAnalysis.analyzeMemberships`) so the answer matches
 * what the Users tab and user comparison already show.
 *
 * @see {@link summarizeMemberSources}
 */

import type { OktaGroup, OktaUser, MembershipRule, GroupType } from '../types';
import { analyzeMemberships } from '../utils/membershipAnalysis';

/** A feeding rule and how many of the group's members it accounts for. */
export interface RuleContribution {
  ruleId: string;
  ruleName: string;
  /** Members attributed to this rule for the group. */
  count: number;
}

/** The manual-vs-rule breakdown of a group's membership. */
export interface MemberSourceBreakdown {
  /** Total members analyzed. */
  total: number;
  /** Members with no attributed rule (manual adds). */
  direct: number;
  /** Members attributed to a feeding rule. */
  ruleBased: number;
  /** Per-rule contribution, sorted by count descending. */
  byRule: RuleContribution[];
}

/** Minimal group identity the aggregation needs. */
export interface GroupIdentity {
  id: string;
  name: string;
  type: GroupType;
}

/**
 * Split a group's members into manual vs rule-managed and tally each feeding
 * rule's contribution.
 *
 * @param group - The group being explained (id/name/type).
 * @param members - The group's current members.
 * @param rules - Candidate rules (ideally those targeting the group).
 * @returns A {@link MemberSourceBreakdown}. Pure — no API calls.
 */
export function summarizeMemberSources(
  group: GroupIdentity,
  members: OktaUser[],
  rules: MembershipRule[],
): MemberSourceBreakdown {
  // analyzeMemberships classifies one user's groups; feed it a single-group list
  // shaped as the OktaGroup it expects (only id/type/profile.name are read).
  const oktaGroup: OktaGroup = {
    id: group.id,
    type: group.type,
    profile: { name: group.name },
  };

  let direct = 0;
  let ruleBased = 0;
  const ruleCounts = new Map<string, RuleContribution>();

  for (const member of members) {
    const [membership] = analyzeMemberships([oktaGroup], rules, member);
    if (membership.membershipType === 'RULE_BASED') {
      ruleBased++;
      const rule = membership.rule;
      if (rule) {
        const existing = ruleCounts.get(rule.id);
        if (existing) existing.count++;
        else ruleCounts.set(rule.id, { ruleId: rule.id, ruleName: rule.name, count: 1 });
      }
    } else {
      direct++;
    }
  }

  const byRule = Array.from(ruleCounts.values()).sort((a, b) => b.count - a.count);

  return { total: members.length, direct, ruleBased, byRule };
}
