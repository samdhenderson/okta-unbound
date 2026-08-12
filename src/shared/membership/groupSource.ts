/**
 * @module shared/membership/groupSource
 * @description Pure "why does this group exist?" aggregation.
 *
 * Given a group's current members and the rules that target it, splits the
 * membership into manual (DIRECT) vs rule-managed (RULE_BASED) and tallies how
 * many members each feeding rule accounts for.
 *
 * Attribution is answered from two sources, in priority order:
 *
 * 1. **Okta itself.** When the membership listing was read with
 *    `expand=group-rules`, each member carries the rules Okta says put them
 *    there — the same data the admin console's own "assigned by rule" column
 *    shows. Free (no extra request) and authoritative, so it wins outright.
 *    See {@link module:shared/membership/memberRuleAttribution}.
 * 2. **The client-side heuristic**, for any member Okta said nothing about:
 *    `shared/utils/membershipAnalysis.analyzeMemberships`, the app's single
 *    source of truth, so those answers still match what the Users tab and user
 *    comparison show. Members it could only attribute by guessing are counted
 *    as `unattributed`, letting callers distinguish "rule-managed" from
 *    "probably rule-managed".
 *
 * The fallback is not vestigial: `expand=group-rules` is a private,
 * undocumented parameter, so an org that ignores it degrades to exactly the
 * previous behaviour rather than to nothing.
 *
 * @see {@link summarizeMemberSources}
 */

import type { OktaGroup, OktaUser, MembershipRule, GroupType } from '../types';
import { analyzeMemberships } from '../utils/membershipAnalysis';
import { readEmbeddedGroupRules } from './memberRuleAttribution';

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
  /**
   * Members counted as rule-managed only *inferentially* — at least one feeding
   * rule's condition could not be evaluated client-side, so the classifier fell
   * back to a heuristic (`attribution: 'inferred'`).
   *
   * **A subset of `ruleBased`, not a fourth disjoint bucket** — the invariants
   * are `direct + ruleBased === total` and `unattributed <= ruleBased`. A UI
   * that wants three exclusive buckets should render
   * `ruleBased - unattributed` as "confirmed rule-managed".
   *
   * Members Okta attributed itself (`expand=group-rules`) are never counted
   * here — that answer is a fact, not an inference.
   */
  unattributed: number;
  /**
   * Per-rule contribution, sorted by count descending.
   *
   * A member Okta attributes to two rules is credited to **both** — so
   * `byRule`'s counts can sum to more than `ruleBased`. Only `total`,
   * `direct` and `ruleBased` count members; `byRule` counts attributions.
   */
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
 * Per member, Okta's own attribution is used when the row carries it (see the
 * module header); otherwise the client-side heuristic decides.
 *
 * @param group - The group being explained (id/name/type).
 * @param members - The group's current members. Rows fetched with
 * `expand=group-rules` carry Okta's attribution and are read authoritatively;
 * rows without it fall back to the heuristic, member by member.
 * @param rules - Candidate rules (ideally those targeting the group). Only the
 * fallback path consults them — Okta's embed already names its rules.
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
  let unattributed = 0;
  const ruleCounts = new Map<string, RuleContribution>();

  const credit = (ruleId: string, ruleName: string) => {
    const existing = ruleCounts.get(ruleId);
    if (existing) existing.count++;
    else ruleCounts.set(ruleId, { ruleId, ruleName, count: 1 });
  };

  for (const member of members) {
    const attribution = readEmbeddedGroupRules(member);

    // Okta named the feeding rule(s): authoritative, and never `unattributed`.
    // A member fed by two rules is credited to both but counted once.
    if (attribution.state === 'rules') {
      ruleBased++;
      for (const rule of attribution.rules) credit(rule.id, rule.name);
      continue;
    }

    // Okta asserted "no rule feeds this member" — an exactly-known manual add.
    // Not applied to APP_GROUPs: there the source is the application, not a
    // group rule, so an empty group-rules embed says nothing about it and the
    // heuristic's application-managed classification still stands.
    if (attribution.state === 'no-rules' && group.type !== 'APP_GROUP') {
      direct++;
      continue;
    }

    // Okta told us nothing about this member — fall back to the heuristic.
    const [membership] = analyzeMemberships([oktaGroup], rules, member);
    if (membership.membershipType === 'RULE_BASED') {
      ruleBased++;
      if (membership.attribution === 'inferred') unattributed++;
      const rule = membership.rule;
      if (rule) credit(rule.id, rule.name);
    } else {
      direct++;
    }
  }

  const byRule = Array.from(ruleCounts.values()).sort((a, b) => b.count - a.count);

  return { total: members.length, direct, ruleBased, unattributed, byRule };
}
