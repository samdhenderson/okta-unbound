/**
 * @module hooks/useOktaApi/groupAnalysis
 * @description Group comparison, cross-group user search, and staleness scoring
 */

import type { OktaUser, GroupSummary, GroupComparisonResult, StalenessInfo } from '../../../shared/types';

type GetAllGroupMembers = (groupId: string) => Promise<OktaUser[]>;

export function createGroupAnalysisOperations(getAllGroupMembers: GetAllGroupMembers) {
  /**
   * Compare 2-5 groups to find overlapping and unique users.
   * Fetches members for each group, computes set intersection and per-group uniques.
   */
  const compareGroups = async (
    groups: Array<{ id: string; name: string }>,
    onProgress?: (current: number, total: number, message?: string) => void,
    memberCache?: Map<string, OktaUser[]>
  ): Promise<GroupComparisonResult> => {
    if (groups.length < 2 || groups.length > 5) {
      throw new Error('Select 2-5 groups to compare');
    }

    const groupMembers = new Map<string, Set<string>>();
    const groupInfo: GroupComparisonResult['groups'] = [];

    // Fetch members for each group (use cache if available)
    for (let i = 0; i < groups.length; i++) {
      const { id, name } = groups[i];
      onProgress?.(i + 1, groups.length, `Loading members for ${name}...`);

      let members: OktaUser[];
      if (memberCache?.has(id)) {
        members = memberCache.get(id)!;
      } else {
        members = await getAllGroupMembers(id);
        memberCache?.set(id, members);
      }

      const userIds = new Set(members.map((m) => m.id));
      groupMembers.set(id, userIds);
      groupInfo.push({ id, name, memberCount: userIds.size });
    }

    // Compute intersection (users in ALL groups)
    const allSets = Array.from(groupMembers.values());
    const intersection = [...allSets[0]].filter((userId) => allSets.every((s) => s.has(userId)));

    // Compute unique members per group (users only in that group)
    const uniqueMembers: Record<string, string[]> = {};
    for (const [groupId, members] of groupMembers) {
      const otherSets = Array.from(groupMembers.entries())
        .filter(([id]) => id !== groupId)
        .map(([, s]) => s);

      uniqueMembers[groupId] = [...members].filter((userId) => !otherSets.some((s) => s.has(userId)));
    }

    // Total unique users across all groups
    const allUsers = new Set<string>();
    for (const members of groupMembers.values()) {
      for (const userId of members) {
        allUsers.add(userId);
      }
    }

    return {
      groups: groupInfo,
      intersection,
      uniqueMembers,
      totalUniqueUsers: allUsers.size,
    };
  };

  /**
   * Search for a user across the local group members cache.
   * Pure in-memory operation, no API calls.
   */
  const searchUserAcrossGroups = (
    query: string,
    groupMembersCache: Map<string, OktaUser[]>,
    groupNames: Map<string, string>
  ): Array<{ groupId: string; groupName: string; user: OktaUser }> => {
    const q = query.toLowerCase();
    const results: Array<{ groupId: string; groupName: string; user: OktaUser }> = [];
    const seenUserGroups = new Set<string>();

    for (const [groupId, members] of groupMembersCache) {
      for (const user of members) {
        const matches =
          user.profile.email?.toLowerCase().includes(q) ||
          user.profile.login?.toLowerCase().includes(q) ||
          user.profile.firstName?.toLowerCase().includes(q) ||
          user.profile.lastName?.toLowerCase().includes(q) ||
          `${user.profile.firstName} ${user.profile.lastName}`.toLowerCase().includes(q);

        if (matches) {
          const key = `${user.id}_${groupId}`;
          if (!seenUserGroups.has(key)) {
            seenUserGroups.add(key);
            results.push({
              groupId,
              groupName: groupNames.get(groupId) || groupId,
              user,
            });
          }
        }
      }
    }

    return results;
  };

  /**
   * Calculate a staleness score for a group (0-100, 100 = most stale).
   * Pure calculation, no API calls.
   */
  const calculateStaleness = (group: GroupSummary): StalenessInfo => {
    let score = 0;
    const factors: string[] = [];

    // Empty group
    if (group.memberCount === 0) {
      score += 30;
      factors.push('Empty group');
    } else if (group.memberCount < 5) {
      score += 15;
      factors.push('Very few members');
    }

    // No rules
    if (!group.hasRules && group.ruleCount === 0) {
      score += 20;
      factors.push('No group rules');
    }

    // Age of last update
    if (group.lastUpdated) {
      const daysSinceUpdate = (Date.now() - group.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 365) {
        score += 25;
        factors.push('Not updated in over a year');
      } else if (daysSinceUpdate > 180) {
        score += 15;
        factors.push('Not updated in 6+ months');
      } else if (daysSinceUpdate > 90) {
        score += 8;
        factors.push('Not updated in 3+ months');
      }
    } else {
      score += 10;
      factors.push('No update date available');
    }

    // No description (poor metadata hygiene)
    if (!group.description) {
      score += 10;
      factors.push('No description');
    }

    return { score: Math.min(score, 100), factors };
  };

  return {
    compareGroups,
    searchUserAcrossGroups,
    calculateStaleness,
  };
}
