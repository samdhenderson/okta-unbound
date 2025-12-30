/**
 * @module hooks/useOktaApi/groupBulkOps
 * @description Bulk operations across multiple groups
 */

import type { CoreApi } from './core';
import type { OktaUser } from './types';

export function createGroupBulkOperations(
  coreApi: CoreApi,
  removeUserFromGroup: (groupId: string, groupName: string, user: OktaUser, skipUndoLog?: boolean) => Promise<any>,
  getAllGroupMembers: (groupId: string) => Promise<OktaUser[]>
) {
  /**
   * Execute bulk operation across multiple groups
   */
  const executeBulkOperation = async (
    operation: any,
    onProgress?: (current: number, total: number, currentGroupName: string) => void
  ): Promise<any[]> => {
    const results: any[] = [];
    const totalGroups = operation.targetGroups.length;

    for (let i = 0; i < totalGroups; i++) {
      const groupId = operation.targetGroups[i];

      try {
        // Get group name
        const groupResponse = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`);
        const groupName = groupResponse.data?.profile?.name || groupId;

        onProgress?.(i + 1, totalGroups, groupName);

        let result: any = { groupId, groupName, status: 'success', itemsProcessed: 0 };

        // Execute operation based on type
        switch (operation.type) {
          case 'cleanup_inactive': {
            const members = await getAllGroupMembers(groupId);
            const inactiveStatuses = ['DEPROVISIONED', 'SUSPENDED', 'LOCKED_OUT'];
            const inactiveUsers = members.filter((u) => inactiveStatuses.includes(u.status));

            result.itemsProcessed = inactiveUsers.length;

            for (const user of inactiveUsers) {
              await removeUserFromGroup(groupId, groupName, user);
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
            break;
          }

          case 'export_all': {
            const members = await getAllGroupMembers(groupId);
            result.itemsProcessed = members.length;
            result.members = members;
            break;
          }

          case 'remove_user': {
            if (operation.config?.userId) {
              const removeResult = await coreApi.makeApiRequest(
                `/api/v1/groups/${groupId}/users/${operation.config.userId}`,
                'DELETE'
              );
              result.status = removeResult.success ? 'success' : 'failed';
              result.itemsProcessed = removeResult.success ? 1 : 0;
              if (!removeResult.success) {
                result.errors = [removeResult.error || 'Unknown error'];
              }
            }
            break;
          }

          default:
            result.status = 'failed';
            result.errors = [`Unknown operation type: ${operation.type}`];
        }

        results.push(result);
      } catch (error) {
        results.push({
          groupId,
          groupName: groupId,
          status: 'failed',
          itemsProcessed: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return results;
  };

  /**
   * Compare groups to find overlaps
   */
  const compareGroups = async (groupIds: string[]): Promise<any> => {
    const groupData: any[] = [];

    // Fetch members for each group
    for (const groupId of groupIds) {
      const groupResponse = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`);
      const members = await getAllGroupMembers(groupId);

      groupData.push({
        id: groupId,
        name: groupResponse.data?.profile?.name || groupId,
        type: groupResponse.data?.type,
        members,
        memberIds: new Set(members.map((m: any) => m.id)),
      });
    }

    // Calculate overlaps
    const overlaps: any[] = [];
    for (let i = 0; i < groupData.length; i++) {
      for (let j = i + 1; j < groupData.length; j++) {
        const group1 = groupData[i];
        const group2 = groupData[j];

        const sharedUserIds = [...group1.memberIds].filter((id: string) => group2.memberIds.has(id));
        const uniqueToGroup1 = group1.members.length - sharedUserIds.length;
        const uniqueToGroup2 = group2.members.length - sharedUserIds.length;

        overlaps.push({
          group1: { id: group1.id, name: group1.name },
          group2: { id: group2.id, name: group2.name },
          sharedUsers: sharedUserIds.length,
          uniqueToGroup1,
          uniqueToGroup2,
        });
      }
    }

    // Calculate unique users across all groups
    const allUserIds = new Set<string>();
    groupData.forEach((g) => {
      g.members.forEach((m: any) => allUserIds.add(m.id));
    });

    return {
      totalGroups: groupData.length,
      totalUniqueUsers: allUserIds.size,
      groupData,
      overlaps,
    };
  };

  return {
    executeBulkOperation,
    compareGroups,
  };
}
