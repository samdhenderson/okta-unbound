/**
 * @module shared/membership/ruleImpact
 * @description Pure engine for previewing what a group rule currently holds up.
 *
 * Answers one question an admin needs before touching a rule: **which current
 * members of each target group are held by this rule alone?** — that is, whose
 * membership no *other* active, non-excluding rule also explains. It is
 * deliberately I/O-free — callers supply the rule set and each target group's
 * current members, and these functions do the set math. The classification is
 * consistent with the app's single source of truth for membership attribution
 * (`shared/utils/membershipAnalysis`): a member is attributed to a rule for a
 * group when an ACTIVE rule that targets the group and does not exclude them is
 * that rule, and `APP_GROUP` membership is application-managed and never
 * attributed to a group rule.
 *
 * **This set is not "who loses access", and the distinction is the module's whole
 * point (D-052).** The same population means something different per verb, and
 * only one of the three takes anybody out of a group:
 *
 * | Verb | What happens to the members held by this rule alone | Reversible? |
 * | --- | --- | --- |
 * | Deactivate | Nobody moves. Membership remains; the rule no longer applies to new users. They are simply no longer explained by any rule — **unattributed**. | Yes — reactivate. |
 * | Delete, `removeUsers=false` (or omitted) | They stay in the group as ordinary manual members; the rule no longer manages the membership. | No. |
 * | Delete, `removeUsers=true` | Okta removes them from the group entirely. | No. |
 *
 * So callers must name the consequence themselves from the verb they are about
 * to perform; the engine reports the population and nothing more. Rendering this
 * count as an access loss under a deactivate is the defect D-052 fixed, and the
 * hedge ADR-0036 requires still applies to the population itself: a manual add
 * cannot always be told apart from a rule-placed membership.
 *
 * The reusable population-diff shape here (`heldSolelyByRule`/`unaffected`) is
 * exactly what a future rule-consolidation / merge preview would consume, so it
 * lives in `shared/` rather than beside the UI.
 *
 * @see {@link classifyGroupImpact}
 * @see {@link summarizeRuleImpact}
 */

import type { OktaGroupRule, OktaUser, GroupType } from '../types';

/**
 * A group rule reduced to just the fields impact analysis needs: its lifecycle
 * status, the groups it assigns matched users to, and the users it explicitly
 * excludes.
 */
export interface ImpactRule {
  /** Rule id. */
  id: string;
  /** Whether the rule is currently in force. Only `ACTIVE` rules place members. */
  status: 'ACTIVE' | 'INACTIVE';
  /** Ids of the groups the rule assigns matched users to. */
  targetGroupIds: string[];
  /** Ids of users explicitly excluded from the rule (never placed by it). */
  excludedUserIds: string[];
}

/**
 * Normalize a raw Okta group rule into the minimal {@link ImpactRule} shape.
 *
 * @param rule - A rule as returned by `GET /api/v1/groups/rules`.
 * @returns The reduced rule used by the impact functions.
 */
export function toImpactRule(rule: OktaGroupRule): ImpactRule {
  return {
    id: rule.id,
    status: rule.status,
    targetGroupIds: rule.actions?.assignUserToGroups?.groupIds ?? [],
    excludedUserIds: rule.conditions?.people?.users?.exclude ?? [],
  };
}

/** A target group paired with its current members and (optionally) its type. */
export interface TargetGroupMembers {
  /** Group id. */
  groupId: string;
  /** Group display name. */
  groupName: string;
  /** Group type; `APP_GROUP` membership is treated as application-managed. */
  groupType?: GroupType;
  /** The group's current members. */
  members: OktaUser[];
}

/**
 * Partition one target group's current members into those held by `ruleId`
 * **alone** and those whose membership nothing about this rule touches.
 *
 * A member is considered **managed by this rule** for the group when this rule
 * is among the ACTIVE rules that target the group and do not exclude the member.
 * Such a member is **held solely by this rule** only when no *other* active,
 * non-excluding rule also targets the group; otherwise the other rule still
 * explains the membership and they are **unaffected**. Members this rule does
 * not manage (manual adds, or members placed solely by other rules) are always
 * unaffected. `APP_GROUP` membership is application-managed, so no member is
 * attributed to the group rule.
 *
 * `heldSolelyByRule` is the population whose *meaning* changes when the rule is
 * touched — it is **not** a set of people who lose access. See the module header
 * for what each verb does to it; deactivating leaves every one of them in the
 * group, merely unattributed.
 *
 * @param ruleId - The rule being analyzed.
 * @param target - The target group and its current members.
 * @param rules - All candidate rules (normalized via {@link toImpactRule}).
 * @returns The `heldSolelyByRule` and `unaffected` partitions (input order preserved).
 */
export function classifyGroupImpact(
  ruleId: string,
  target: TargetGroupMembers,
  rules: ImpactRule[],
): { heldSolelyByRule: OktaUser[]; unaffected: OktaUser[] } {
  // APP_GROUP membership is granted by the application, not a group rule, so no
  // group rule holds it up and no verb against one can change it.
  if (target.groupType === 'APP_GROUP') {
    return { heldSolelyByRule: [], unaffected: [...target.members] };
  }

  const activeRulesForGroup = rules.filter(
    (r) => r.status === 'ACTIVE' && r.targetGroupIds.includes(target.groupId),
  );

  const heldSolelyByRule: OktaUser[] = [];
  const unaffected: OktaUser[] = [];

  for (const member of target.members) {
    const nonExcluding = activeRulesForGroup.filter((r) => !r.excludedUserIds.includes(member.id));
    const managedByThisRule = nonExcluding.some((r) => r.id === ruleId);

    if (!managedByThisRule) {
      // Manual member, or placed only by other rules — unaffected by this rule.
      unaffected.push(member);
      continue;
    }

    const otherActiveRules = nonExcluding.filter((r) => r.id !== ruleId);
    if (otherActiveRules.length === 0) {
      heldSolelyByRule.push(member);
    } else {
      unaffected.push(member);
    }
  }

  return { heldSolelyByRule, unaffected };
}

/** What a single target group's roster owes to the analyzed rule. */
export interface TargetGroupImpact {
  /** Group id. */
  groupId: string;
  /** Group display name. */
  groupName: string;
  /** Total current members of the group. */
  memberCount: number;
  /** Number of members held by the analyzed rule alone. */
  heldSolelyCount: number;
  /**
   * Members held by the analyzed rule alone (full list; the UI decides how many
   * to show). Not a set of people who lose access — see the module header.
   */
  heldSolelyByRule: OktaUser[];
}

/** What a rule currently holds up, aggregated across its target groups. */
export interface RuleImpactSummary {
  /** The analyzed rule's id. */
  ruleId: string;
  /** The analyzed rule's name. */
  ruleName: string;
  /** Per-target-group impact, in the order the targets were supplied. */
  targetGroups: TargetGroupImpact[];
  /** Distinct users across all target groups (a user in two targets counts once). */
  distinctMemberCount: number;
  /**
   * Distinct users held by the analyzed rule alone in at least one target group.
   * On deactivate this is who becomes **unattributed**; on delete with
   * `removeUsers=true` it is who is removed. It is never, on its own, a loss.
   */
  totalHeldSolely: number;
}

/**
 * Summarize which members a rule holds up across all its target groups,
 * de-duplicating users who appear in more than one target group.
 *
 * @param ruleId - The rule being analyzed.
 * @param ruleName - The rule's display name (echoed into the summary).
 * @param targets - Each target group with its current members.
 * @param rules - All candidate rules (normalized via {@link toImpactRule}).
 * @returns A {@link RuleImpactSummary} with per-group and org-level counts.
 */
export function summarizeRuleImpact(
  ruleId: string,
  ruleName: string,
  targets: TargetGroupMembers[],
  rules: ImpactRule[],
): RuleImpactSummary {
  const targetGroups: TargetGroupImpact[] = [];
  const distinctMembers = new Set<string>();
  const distinctHeldSolely = new Set<string>();

  for (const target of targets) {
    const { heldSolelyByRule } = classifyGroupImpact(ruleId, target, rules);
    for (const m of target.members) distinctMembers.add(m.id);
    for (const u of heldSolelyByRule) distinctHeldSolely.add(u.id);

    targetGroups.push({
      groupId: target.groupId,
      groupName: target.groupName,
      memberCount: target.members.length,
      heldSolelyCount: heldSolelyByRule.length,
      heldSolelyByRule,
    });
  }

  return {
    ruleId,
    ruleName,
    targetGroups,
    distinctMemberCount: distinctMembers.size,
    totalHeldSolely: distinctHeldSolely.size,
  };
}
