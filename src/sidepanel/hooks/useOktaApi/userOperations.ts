/**
 * @module hooks/useOktaApi/userOperations
 * @description User management operations
 */

import type { CoreApi } from './core';

export function createUserOperations(coreApi: CoreApi) {
  /**
   * Get user's last login date
   */
  const getUserLastLogin = async (userId: string): Promise<Date | null> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/users/${userId}`);
      if (response.success && response.data?.lastLogin) {
        return new Date(response.data.lastLogin);
      }
      return null;
    } catch (error) {
      console.error(`[useOktaApi] Failed to get last login for user ${userId}:`, error);
      return null;
    }
  };

  /**
   * Get count of app assignments for a user
   */
  const getUserAppAssignments = async (userId: string): Promise<number> => {
    try {
      // Fetch first page with limit=200 to get app assignments count
      const response = await coreApi.makeApiRequest(`/api/v1/apps?filter=user.id+eq+"${userId}"&limit=200`);
      if (response.success && response.data) {
        const firstPageCount = response.data.length;

        // Check if there are more pages by looking for Link header with rel="next"
        const linkHeader = response.headers?.['link'] || response.headers?.['Link'];
        const hasMorePages = linkHeader && linkHeader.includes('rel="next"');

        if (hasMorePages) {
          return firstPageCount;
        }

        return firstPageCount;
      }
      return 0;
    } catch (error) {
      console.error(`[useOktaApi] Failed to get app assignments for user ${userId}:`, error);
      return 0;
    }
  };

  /**
   * Batch get user details
   */
  const batchGetUserDetails = async (
    userIds: string[],
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<string, any>> => {
    const userDetailsMap = new Map<string, any>();
    const batchSize = 10; // Process 10 users concurrently

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (userId) => {
        try {
          const response = await coreApi.makeApiRequest(`/api/v1/users/${userId}`);
          if (response.success && response.data) {
            return { userId, data: response.data };
          }
          return { userId, data: null };
        } catch (error) {
          console.error(`[useOktaApi] Failed to fetch user ${userId}:`, error);
          return { userId, data: null };
        }
      });

      const results = await Promise.all(batchPromises);
      results.forEach(({ userId, data }) => {
        if (data) {
          userDetailsMap.set(userId, data);
        }
      });

      onProgress?.(Math.min(i + batchSize, userIds.length), userIds.length);

      // Rate limiting - small delay between batches
      if (i + batchSize < userIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return userDetailsMap;
  };

  /**
   * Get user's group memberships count
   */
  const getUserGroupMemberships = async (userId: string): Promise<number> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/users/${userId}/groups?limit=1`);
      if (response.success && response.headers?.['x-total-count']) {
        return parseInt(response.headers['x-total-count'], 10);
      }
      return 0;
    } catch (error) {
      console.error(`[useOktaApi] Failed to get group memberships for user ${userId}:`, error);
      return 0;
    }
  };

  /**
   * Search for users by name, email, or login
   */
  const searchUsers = async (
    query: string
  ): Promise<
    Array<{ id: string; email: string; firstName: string; lastName: string; login: string; status: string }>
  > => {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      // Use Okta's search API with the q parameter for flexible search
      const response = await coreApi.makeApiRequest(`/api/v1/users?q=${encodeURIComponent(query)}&limit=20`);

      if (response.success && response.data) {
        return response.data.map((user: any) => ({
          id: user.id,
          email: user.profile?.email || '',
          firstName: user.profile?.firstName || '',
          lastName: user.profile?.lastName || '',
          login: user.profile?.login || '',
          status: user.status || 'UNKNOWN',
        }));
      }
      return [];
    } catch (error) {
      console.error('[useOktaApi] searchUsers error:', error);
      return [];
    }
  };

  /**
   * Get user details by ID
   */
  const getUserById = async (
    userId: string
  ): Promise<{ id: string; email: string; firstName: string; lastName: string; login: string; status: string } | null> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/users/${userId}`);
      if (response.success && response.data) {
        const user = response.data;
        return {
          id: user.id,
          email: user.profile?.email || '',
          firstName: user.profile?.firstName || '',
          lastName: user.profile?.lastName || '',
          login: user.profile?.login || '',
          status: user.status || 'UNKNOWN',
        };
      }
      return null;
    } catch (error) {
      console.error('[useOktaApi] getUserById error:', error);
      return null;
    }
  };

  /**
   * Suspend an active user, preventing them from signing in.
   * Only valid for users in ACTIVE status.
   */
  const suspendUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await coreApi.makeApiRequest(`/api/v1/users/${userId}/lifecycle/suspend`, 'POST');
    return { success: result.success, error: result.error };
  };

  /**
   * Unsuspend a suspended user, restoring their ability to sign in.
   * Only valid for users in SUSPENDED status.
   */
  const unsuspendUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await coreApi.makeApiRequest(`/api/v1/users/${userId}/lifecycle/unsuspend`, 'POST');
    return { success: result.success, error: result.error };
  };

  /**
   * Trigger a password reset email for the user.
   * Sends an email with a one-time reset link. Valid for ACTIVE and RECOVERY status users.
   */
  const resetPassword = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await coreApi.makeApiRequest(
      `/api/v1/users/${userId}/lifecycle/reset_password?sendEmail=true`,
      'POST'
    );
    return { success: result.success, error: result.error };
  };

  return {
    getUserLastLogin,
    getUserAppAssignments,
    batchGetUserDetails,
    getUserGroupMemberships,
    searchUsers,
    getUserById,
    suspendUser,
    unsuspendUser,
    resetPassword,
  };
}
