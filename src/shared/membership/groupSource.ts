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
 *    `shared/utils/membershipAnalysis.analyzeMemberships`. Members it could only
 *    attribute by guessing are counted as `unattributed`, letting callers
 *    distinguish "rule-managed" from "probably rule-managed".
 *
 * The fallback is not vestigial: `expand=group-rules` is a private,
 * undocumented parameter, so an org that ignores it degrades to exactly the
 * previous behaviour rather than to nothing.
 *
 * ## Where this agrees with the user view, and where it deliberately does not
 *
 * The user view (`sidepanel/hooks/useUserMemberships`) has **no** source 1 —
 * `GET /api/v1/users/{id}/groups` carries no attribution embed — so it runs
 * source 2 alone. The reconciliation contract (ADR-0020, pinned by
 * `attributionParity.test.ts`) is therefore:
 *
 * - Where {@link readEmbeddedGroupRules} answers `unknown`, both views run the
 *   same heuristic over the same inputs and **must** produce the same verdict.
 * - Where it answers `rules` or `no-rules`, this view is Okta-asserted and the
 *   user view is client-evaluated. They may differ, and the difference is
 *   *provenance*, which {@link RuleMemberCounts.oktaAttributedCount} /
 *   {@link RuleMemberCounts.clientAttributedCount} already carry so a UI can say
 *   so out loud. Provenance is not a fourth `MembershipAttribution` value.
 *
 * ## Two ways to count a rule
 *
 * The result carries both, because they answer different questions and only one
 * of them can be drawn as a bar:
 *
 * - {@link MemberSourceBreakdown.byRule} counts **attributions** — "how many of
 *   this group's members does this rule account for?" A member Okta credits to
 *   two rules is counted in both, so these sum to more than `ruleBased`.
 * - {@link MemberSourceBreakdown.byRuleMembers} counts **people, exclusively** —
 *   members that rule *alone* explains — with multi-rule members pulled out into
 *   {@link MemberSourceBreakdown.multiRuleMembers}. Those buckets are disjoint,
 *   so a stacked meter built from them can never over-fill its track.
 *
 * @see {@link summarizeMemberSources}
 */

import type { OktaGroup, OktaUser, MembershipRule, GroupType, GroupMembership } from '../types';
import {
  analyzeMemberships,
  attributionNamesRules,
  isDeducedAttribution,
} from '../utils/membershipAnalysis';
import { readEmbeddedGroupRules, type MemberRuleAttribution } from './memberRuleAttribution';

/** A feeding rule and how many of the group's members it accounts for. */
export interface RuleContribution {
  ruleId: string;
  ruleName: string;
  /** Members attributed to this rule for the group. */
  count: number;
}

/**
 * One feeding rule counted the way a **stacked meter** needs it: people rather
 * than attributions, plus where the attribution came from.
 *
 * {@link RuleContribution} cannot drive a meter, because a member Okta credits
 * to two rules is counted under *both* — segments built from it would sum past
 * the member count and over-fill the track. {@link soleCount} fixes that by
 * counting only members this rule alone accounts for; a multi-rule member is
 * counted once, elsewhere, in {@link MemberSourceBreakdown.multiRuleMembers}.
 */
export interface RuleMemberCounts {
  ruleId: string;
  ruleName: string;
  /**
   * Members whose **only** attributed rule is this one, *and* whose membership
   * was not merely inferred.
   *
   * Mutually exclusive across rules, and disjoint from both
   * {@link MemberSourceBreakdown.multiRuleMembers} and
   * {@link MemberSourceBreakdown.unattributed} — which is exactly what makes a
   * stacked meter's segments add up. A member the fallback heuristic could only
   * *deduce* (`attribution: 'inferred'` or `'ambiguous'`) is deliberately
   * **excluded**: it is already carried by `unattributed`, so counting it here
   * too would double it.
   */
  soleCount: number;
  /**
   * Attributions to this rule that **Okta itself** asserted, via the member
   * listing's `_embedded['group-rules']`. A fact, not a deduction.
   */
  oktaAttributedCount: number;
  /**
   * Attributions to this rule the **client-side heuristic** produced (whether it
   * evaluated the rule's condition or fell back to an evidenced guess). Never
   * Okta's own answer, so a UI must not present these with the weight of a fact.
   *
   * A member the heuristic classified `ambiguous` is credited to **no** rule at
   * all — it has a candidate set rather than an answer — so it appears only in
   * {@link MemberSourceBreakdown.unattributed}.
   *
   * `oktaAttributedCount + clientAttributedCount` equals this rule's entry in
   * {@link MemberSourceBreakdown.byRule}.
   */
  clientAttributedCount: number;
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
   * back to a heuristic and produced a deduction rather than a fact
   * (`attribution: 'inferred'` or `'ambiguous'`; see
   * `shared/utils/membershipAnalysis.isDeducedAttribution`).
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
  /**
   * The same rules as {@link byRule}, counted as **people** so a meter can draw
   * one mutually-exclusive segment per rule, sorted by `soleCount` descending.
   *
   * The exclusivity invariant callers rely on is
   * `Σ soleCount + multiRuleMembers + unattributed <= ruleBased`, so a renderer
   * can show every rule segment, a "matched by 2+ rules" segment, an
   * indeterminate segment, and still have a non-negative remainder of
   * rule-managed members that no single named rule explains (an `APP_GROUP`'s
   * application-managed members are the common case).
   *
   * **Optional**: `undefined` means per-rule exclusivity was never computed —
   * a hand-built or previously-cached breakdown. That is *unknown*, not "no
   * rules": consumers must fall back to one aggregate rule-managed segment
   * rather than claiming every member is unexplained.
   */
  byRuleMembers?: RuleMemberCounts[];
  /**
   * Members attributed to **more than one** rule at once, counted once each.
   *
   * Rare but real (a live 70-member group returned 68 single-rule, 1 two-rule,
   * 1 manual), and the reason per-rule segments cannot be drawn from
   * {@link byRule}. `undefined` alongside an absent {@link byRuleMembers} means
   * "not computed"; `0` means "computed, and there were none".
   */
  multiRuleMembers?: number;
}

/**
 * One member's exclusive membership verdict — the decision the meter, the
 * filter and the counters all have to agree on.
 *
 * This exists because two consumers need the same answer at different costs.
 * {@link summarizeMemberSources} only wants tallies, and pays for the
 * client-side heuristic only when Okta's embed said nothing.
 * {@link module:shared/membership/memberSourceIndex.buildMemberSourceIndex}
 * needs a full {@link GroupMembership} per member (a row explains *why*, clause
 * by clause), so it runs the heuristic for everyone. Sharing the branch but not
 * the heuristic call is what keeps the meter's segment counts and the filtered
 * list's contents from ever disagreeing about which bucket someone is in,
 * without making the summary pay the row surface's price.
 */
export interface MemberSourceVerdict {
  /** The coarse, exclusive split: a rule put them here, or nothing did. */
  kind: 'ruleBased' | 'direct';
  /**
   * Rules credited with this membership. Empty for a manual add, and empty for
   * a rule-managed member no named rule explains (an `APP_GROUP`'s
   * application-managed members, or an `ambiguous` attribution that carries
   * candidates rather than an answer).
   */
  credited: readonly { id: string; name: string }[];
  /** Whether `credited` came from Okta's embed or from the client heuristic. */
  creditedBy: 'okta' | 'client';
  /**
   * Rule-managed by deduction rather than by evidence — the `unattributed`
   * tally, and the reason such a member owns no exclusive rule segment.
   */
  deduced: boolean;
  /** The single rule that exclusively explains this member, or `null`. */
  soleRuleId: string | null;
  /** Two or more distinct rules credit this member. */
  multiRule: boolean;
}

/** A manual add — the one verdict with nothing to say about rules. */
const DIRECT_VERDICT: MemberSourceVerdict = {
  kind: 'direct',
  credited: [],
  creditedBy: 'client',
  deduced: false,
  soleRuleId: null,
  multiRule: false,
};

/**
 * Decide one member's verdict from Okta's answer and, where that answer does
 * not settle it, the client-side classification.
 *
 * Pure and total. Runs no heuristic itself — `heuristic` is supplied by the
 * caller, which is what lets {@link summarizeMemberSources} skip computing one
 * on the two paths that never consult it.
 *
 * @param answer - What Okta's `expand=group-rules` embed said about this member.
 * @param heuristic - The client-side classification, or `null` when the caller
 * has not computed one. Required only on the fallback path; passing `null`
 * there yields a `direct` verdict, matching the classifier's own treatment of a
 * membership it cannot call rule-based.
 * @param groupType - The group's type. `APP_GROUP` is the one type where an
 * empty embed says nothing, because the source is the application rather than a
 * group rule.
 * @returns The member's {@link MemberSourceVerdict}.
 */
export function memberSourceVerdict(
  answer: MemberRuleAttribution,
  heuristic: GroupMembership | null,
  groupType: GroupType | undefined,
): MemberSourceVerdict {
  // Okta named the feeding rule(s): authoritative, and never `unattributed`.
  // A member fed by two rules is credited to both but counted once.
  // `readEmbeddedGroupRules` already collapsed duplicate ids, so `length` is a
  // distinct-rule count and a `rules` state always carries at least one.
  if (answer.state === 'rules') {
    const sole = answer.rules.length === 1 ? answer.rules[0].id : null;
    return {
      kind: 'ruleBased',
      credited: answer.rules,
      creditedBy: 'okta',
      deduced: false,
      soleRuleId: sole,
      multiRule: sole === null,
    };
  }

  // Okta asserted "no rule feeds this member" — an exactly-known manual add.
  // Not applied to APP_GROUPs: there the source is the application, not a group
  // rule, so an empty group-rules embed says nothing about it and the
  // heuristic's application-managed classification still stands.
  if (answer.state === 'no-rules' && groupType !== 'APP_GROUP') return DIRECT_VERDICT;

  // Okta told us nothing about this member — the heuristic decides.
  if (!heuristic || heuristic.membershipType !== 'RULE_BASED') return DIRECT_VERDICT;

  const deduced = isDeducedAttribution(heuristic.attribution);

  // An `ambiguous` attribution carries a candidate *set*, not an answer.
  // Crediting its entries would manufacture an attribution the classifier
  // explicitly does not have — and inflate every candidate rule's count by a
  // member none of them was shown to explain. The member is already carried by
  // `deduced`, which is the whole of what is known about them.
  if (!attributionNamesRules(heuristic.attribution)) {
    return { ...DIRECT_VERDICT, kind: 'ruleBased', deduced };
  }

  // Exclusive counting, mirroring the Okta path. A deduced member owns no rule
  // segment — it is already carried by `deduced`, and giving it one too would
  // count one person in two segments.
  const sole = !deduced && heuristic.rules.length === 1 ? heuristic.rules[0].id : null;
  return {
    kind: 'ruleBased',
    credited: heuristic.rules.map(({ id, name }) => ({ id, name })),
    creditedBy: 'client',
    deduced,
    soleRuleId: sole,
    multiRule: !deduced && heuristic.rules.length > 1,
  };
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
  let multiRuleMembers = 0;
  const ruleCounts = new Map<string, RuleContribution>();
  const ruleMembers = new Map<string, RuleMemberCounts>();

  const credit = (ruleId: string, ruleName: string) => {
    const existing = ruleCounts.get(ruleId);
    if (existing) existing.count++;
    else ruleCounts.set(ruleId, { ruleId, ruleName, count: 1 });
  };

  const memberCounts = (ruleId: string, ruleName: string): RuleMemberCounts => {
    const existing = ruleMembers.get(ruleId);
    if (existing) return existing;
    const created: RuleMemberCounts = {
      ruleId,
      ruleName,
      soleCount: 0,
      oktaAttributedCount: 0,
      clientAttributedCount: 0,
    };
    ruleMembers.set(ruleId, created);
    return created;
  };

  for (const member of members) {
    const answer = readEmbeddedGroupRules(member);

    // The heuristic is computed only where the verdict actually consults it —
    // Okta's `rules` answer and its non-APP_GROUP `no-rules` answer both settle
    // the question on their own. This is why the branch was extracted rather
    // than shared by having both callers run the classifier: the row surface
    // needs a membership for everyone, and the summary must not start paying
    // for one in the orgs where the embed works.
    const needsHeuristic =
      answer.state === 'unknown' || (answer.state === 'no-rules' && group.type === 'APP_GROUP');
    const heuristic = needsHeuristic ? analyzeMemberships([oktaGroup], rules, member)[0] : null;

    const verdict = memberSourceVerdict(answer, heuristic, group.type);

    if (verdict.kind === 'direct') {
      direct++;
      continue;
    }

    ruleBased++;
    if (verdict.deduced) unattributed++;

    for (const rule of verdict.credited) {
      credit(rule.id, rule.name);
      const counts = memberCounts(rule.id, rule.name);
      if (verdict.creditedBy === 'okta') counts.oktaAttributedCount++;
      else counts.clientAttributedCount++;
    }

    // Exclusive counting: one rule owns the member, or nobody does and the
    // member belongs to the multi-rule bucket instead.
    if (verdict.soleRuleId !== null) {
      const sole = verdict.credited.find((rule) => rule.id === verdict.soleRuleId);
      if (sole) memberCounts(sole.id, sole.name).soleCount++;
    } else if (verdict.multiRule) {
      multiRuleMembers++;
    }
  }

  const byRule = Array.from(ruleCounts.values()).sort((a, b) => b.count - a.count);
  const byRuleMembers = Array.from(ruleMembers.values()).sort(
    (a, b) =>
      b.soleCount - a.soleCount ||
      b.oktaAttributedCount +
        b.clientAttributedCount -
        (a.oktaAttributedCount + a.clientAttributedCount) ||
      a.ruleName.localeCompare(b.ruleName),
  );

  return {
    total: members.length,
    direct,
    ruleBased,
    unattributed,
    byRule,
    byRuleMembers,
    multiRuleMembers,
  };
}
