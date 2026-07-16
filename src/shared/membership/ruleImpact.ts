/**
 * @module shared/membership/ruleImpact
 * @description Pure engine for previewing the access impact of a group rule.
 *
 * Answers the question an admin most needs before touching a rule: **who loses
 * access if this rule is deactivated?** It is deliberately I/O-free — callers
 * supply the rule set and each target group's current members, and these
 * functions do the set math. The classification is consistent with the app's
 * single source of truth for membership attribution
 * (`shared/utils/membershipAnalysis`): a member is attributed to a rule for a
 * group when an ACTIVE rule that targets the group and does not exclude them is
 * that rule, and `APP_GROUP` membership is application-managed and never
 * attributed to a group rule.
 *
 * The reusable population-diff shape here (`losing`/`retaining`) is exactly what
 * a future rule-consolidation / merge preview would consume, so it lives in
 * `shared/` rather than beside the UI.
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
 * Partition one target group's current members into those who would lose access
 * if `ruleId` were deactivated and those who would retain it.
 *
 * A member is considered **managed by this rule** for the group when this rule
 * is among the ACTIVE rules that target the group and do not exclude the member.
 * Such a member **loses** access only when no *other* active, non-excluding rule
 * also targets the group; otherwise the other rule keeps them and they
 * **retain** access. Members this rule does not manage (manual adds, or members
 * placed solely by other rules) always retain. `APP_GROUP` membership is
 * application-managed, so no member is attributed to the group rule.
 *
 * @param ruleId - The rule whose deactivation is being previewed.
 * @param target - The target group and its current members.
 * @param rules - All candidate rules (normalized via {@link toImpactRule}).
 * @returns The `losing` and `retaining` member partitions (input order preserved).
 */
export function classifyGroupImpact(
  ruleId: string,
  target: TargetGroupMembers,
  rules: ImpactRule[],
): { losing: OktaUser[]; retaining: OktaUser[] } {
  // APP_GROUP membership is granted by the application, not a group rule, so
  // deactivating a group rule cannot remove it.
  if (target.groupType === 'APP_GROUP') {
    return { losing: [], retaining: [...target.members] };
  }

  const activeRulesForGroup = rules.filter(
    (r) => r.status === 'ACTIVE' && r.targetGroupIds.includes(target.groupId),
  );

  const losing: OktaUser[] = [];
  const retaining: OktaUser[] = [];

  for (const member of target.members) {
    const nonExcluding = activeRulesForGroup.filter((r) => !r.excludedUserIds.includes(member.id));
    const managedByThisRule = nonExcluding.some((r) => r.id === ruleId);

    if (!managedByThisRule) {
      // Manual member, or placed only by other rules — unaffected by this rule.
      retaining.push(member);
      continue;
    }

    const otherActiveRules = nonExcluding.filter((r) => r.id !== ruleId);
    if (otherActiveRules.length === 0) {
      losing.push(member);
    } else {
      retaining.push(member);
    }
  }

  return { losing, retaining };
}

/** The access impact against a single target group. */
export interface TargetGroupImpact {
  /** Group id. */
  groupId: string;
  /** Group display name. */
  groupName: string;
  /** Total current members of the group. */
  memberCount: number;
  /** Number of members who would lose access on deactivation. */
  losingCount: number;
  /** Members who would lose access (full list; the UI decides how many to show). */
  losing: OktaUser[];
}

/** The aggregate access impact of deactivating a rule across its target groups. */
export interface RuleImpactSummary {
  /** The analyzed rule's id. */
  ruleId: string;
  /** The analyzed rule's name. */
  ruleName: string;
  /** Per-target-group impact, in the order the targets were supplied. */
  targetGroups: TargetGroupImpact[];
  /** Distinct users across all target groups (a user in two targets counts once). */
  distinctMemberCount: number;
  /** Distinct users who would lose access to at least one target group. */
  totalLosing: number;
}

/**
 * Summarize the access impact of deactivating a rule across all its target
 * groups, de-duplicating users who appear in more than one target group.
 *
 * @param ruleId - The rule whose deactivation is being previewed.
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
  const distinctLosers = new Set<string>();

  for (const target of targets) {
    const { losing } = classifyGroupImpact(ruleId, target, rules);
    for (const m of target.members) distinctMembers.add(m.id);
    for (const u of losing) distinctLosers.add(u.id);

    targetGroups.push({
      groupId: target.groupId,
      groupName: target.groupName,
      memberCount: target.members.length,
      losingCount: losing.length,
      losing,
    });
  }

  return {
    ruleId,
    ruleName,
    targetGroups,
    distinctMemberCount: distinctMembers.size,
    totalLosing: distinctLosers.size,
  };
}
