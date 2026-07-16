/**
 * @module shared/membership/mergePlan
 * @description Pure planner for consolidating (merging) groups.
 *
 * The extension cannot delete groups, so "merge" here means **membership
 * consolidation**: copy every source group's members into a chosen survivor,
 * then empty the sources (the now-empty husks are left for the admin to delete in
 * Okta, which handles rule/app dependencies safely). This is fully reversible via
 * the member add/remove writes, so undo can restore the prior state.
 *
 * A source that is fed by an ACTIVE group rule is flagged as a **blocker**:
 * emptying it is futile (the rule re-populates it), so the plan surfaces this so
 * the UI can stop before doing pointless work.
 *
 * @see {@link planGroupMerge}
 */

import type { OktaUser } from '../types';

/** Identity of a group participating in a merge. */
export interface MergeGroupRef {
  id: string;
  name: string;
}

/** A feeding rule reduced to what the blocker check needs. */
export interface MergeFeedingRule {
  name: string;
  status: string;
}

/** The plan for emptying one source group into the survivor. */
export interface MergeSourcePlan {
  id: string;
  name: string;
  /** All current members of the source (removed when emptying it). */
  membersToRemove: OktaUser[];
  /** True when an ACTIVE rule feeds this source (emptying would be futile). */
  hasActiveFeedingRule: boolean;
  /** Names of the ACTIVE feeding rules, for the warning copy. */
  feedingRuleNames: string[];
}

/** The full merge plan. */
export interface MergePlan {
  survivor: MergeGroupRef;
  /** Distinct source members not already in the survivor — added to the survivor. */
  toCopy: OktaUser[];
  /** Per-source emptying plans. */
  sources: MergeSourcePlan[];
  /** `toCopy.length`. */
  totalCopies: number;
  /** Sum of members removed across all sources. */
  totalRemovals: number;
  /** True when any source is fed by an active rule (the UI should block). */
  blocked: boolean;
}

/**
 * Build a {@link MergePlan} from already-fetched members and feeding rules.
 *
 * @param survivor - The group that keeps its members and absorbs the sources'.
 * @param sources - The groups to empty into the survivor.
 * @param membersByGroup - Map of group id → its current members.
 * @param feedingRulesByGroup - Map of group id → the rules that target it.
 * @returns The plan (copies to make, per-source removals, blocker status). Pure.
 */
export function planGroupMerge(
  survivor: MergeGroupRef,
  sources: MergeGroupRef[],
  membersByGroup: Map<string, OktaUser[]>,
  feedingRulesByGroup: Map<string, MergeFeedingRule[]>,
): MergePlan {
  const survivorIds = new Set((membersByGroup.get(survivor.id) ?? []).map((m) => m.id));

  const toCopy: OktaUser[] = [];
  const copySeen = new Set<string>();
  const sourcePlans: MergeSourcePlan[] = [];
  let totalRemovals = 0;

  for (const source of sources) {
    const members = membersByGroup.get(source.id) ?? [];
    totalRemovals += members.length;

    // A member is copied once, and only when the survivor doesn't already have it.
    for (const member of members) {
      if (!survivorIds.has(member.id) && !copySeen.has(member.id)) {
        copySeen.add(member.id);
        toCopy.push(member);
      }
    }

    const activeRules = (feedingRulesByGroup.get(source.id) ?? []).filter(
      (r) => r.status === 'ACTIVE',
    );

    sourcePlans.push({
      id: source.id,
      name: source.name,
      membersToRemove: members,
      hasActiveFeedingRule: activeRules.length > 0,
      feedingRuleNames: activeRules.map((r) => r.name),
    });
  }

  return {
    survivor,
    toCopy,
    sources: sourcePlans,
    totalCopies: toCopy.length,
    totalRemovals,
    blocked: sourcePlans.some((s) => s.hasActiveFeedingRule),
  };
}
