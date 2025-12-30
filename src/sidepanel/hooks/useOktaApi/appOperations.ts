/**
 * @module hooks/useOktaApi/appOperations
 * @description Application assignment operations
 */

import type { CoreApi } from './core';
import type {
  OktaApp,
  UserAppAssignment,
  GroupAppAssignment,
  CreateAppAssignmentRequest,
  AssignmentConversionRequest,
  AssignmentConversionResult,
  BulkAppAssignmentRequest,
  BulkAppAssignmentResult,
  AppAssignmentSecurityAnalysis,
  AssignmentRecommenderResult,
  AppProfileSchema,
} from './types';
import type { AppSummary } from '../../../shared/types';
import type { ConversionAppInfo } from '../../../shared/undoTypes';
import { auditStore } from '../../../shared/storage/auditStore';
import { deepMergeProfiles } from './utilities';
import { analyzeAppSecurity, getAppAssignmentRecommendations } from '../useAppAnalysis';
import { logConvertUserToGroupAssignmentAction } from '../../../shared/undoManager';

export function createAppOperations(coreApi: CoreApi) {
  /**
   * Get all applications in the Okta org (with pagination)
   * Uses /api/v1/apps endpoint
   */
  const getAllApps = async (limit: number = 200): Promise<OktaApp[]> => {
    console.log('[useOktaApi] getAllApps called with limit:', limit);
    try {
      const allApps: OktaApp[] = [];
      let nextUrl: string | null = `/api/v1/apps?limit=${limit}`;
      let pageCount = 0;

      while (nextUrl) {
        pageCount++;
        console.log(`[useOktaApi] getAllApps fetching page ${pageCount}:`, nextUrl);

        const response = await coreApi.makeApiRequest(nextUrl);
        console.log(`[useOktaApi] getAllApps page ${pageCount} response:`, {
          success: response.success,
          dataLength: response.data?.length,
          hasHeaders: !!response.headers,
          linkHeader: response.headers?.link || response.headers?.Link,
        });

        if (response.success && response.data) {
          const apps = Array.isArray(response.data) ? response.data : [response.data];
          allApps.push(...apps);
          console.log(`[useOktaApi] getAllApps page ${pageCount}: added ${apps.length} apps, total now: ${allApps.length}`);

          // Check for pagination link in headers
          const linkHeader = response.headers?.link || response.headers?.Link;
          if (linkHeader && typeof linkHeader === 'string') {
            console.log('[useOktaApi] Link header found:', linkHeader);
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (nextMatch) {
              const fullUrl = nextMatch[1];
              // Extract just the path and query params from the full URL
              try {
                const url = new URL(fullUrl);
                nextUrl = url.pathname + url.search;
                console.log('[useOktaApi] Next URL extracted:', nextUrl);
              } catch (e) {
                // If URL parsing fails, assume it's already a path
                nextUrl = fullUrl;
                console.log('[useOktaApi] Using URL as-is:', nextUrl);
              }
            } else {
              console.log('[useOktaApi] No "next" rel found in link header');
              nextUrl = null;
            }
          } else {
            console.log('[useOktaApi] No link header found - pagination complete');
            nextUrl = null;
          }
        } else {
          console.warn('[useOktaApi] getAllApps response not successful, stopping pagination');
          break;
        }
      }

      console.log(`[useOktaApi] getAllApps completed. Total pages: ${pageCount}, Total apps: ${allApps.length}`);
      return allApps;
    } catch (error) {
      console.error('[useOktaApi] getAllApps error:', error);
      throw error;
    }
  };

  /**
   * Get all apps assigned to a user (with pagination)
   * Uses /api/v1/users/{userId}/appLinks endpoint
   */
  const getUserApps = async (userId: string, expand?: boolean): Promise<UserAppAssignment[]> => {
    console.log('[useOktaApi] getUserApps called with userId:', userId, 'expand:', expand);
    try {
      const allApps: UserAppAssignment[] = [];
      let nextUrl: string | null = `/api/v1/users/${userId}/appLinks`;
      console.log('[useOktaApi] getUserApps URL:', nextUrl);

      while (nextUrl) {
        const response = await coreApi.makeApiRequest(nextUrl);
        console.log('[useOktaApi] getUserApps response:', response.success, 'data length:', response.data?.length);
        if (response.success && response.data) {
          const appLinks = Array.isArray(response.data) ? response.data : [response.data];

          // appLinks returns basic info, we need to fetch full app details if expand is true
          for (const link of appLinks) {
            console.log('[useOktaApi] Processing appLink:', {
              appInstanceId: link.appInstanceId,
              label: link.label,
              appName: link.appName,
            });
            if (expand && link.appInstanceId) {
              // Fetch full app details including assignment profile
              // Note: /api/v1/apps/{appId}/users/{userId} returns 404 if user is assigned via group,
              // so we need to handle that case and fall back to basic info from appLinks
              try {
                const userAssignmentUrl = `/api/v1/apps/${link.appInstanceId}/users/${userId}`;
                console.log('[useOktaApi] Fetching user assignment from:', userAssignmentUrl);
                const appResponse = await coreApi.makeApiRequest(userAssignmentUrl);
                console.log('[useOktaApi] User assignment response:', {
                  success: appResponse.success,
                  status: appResponse.status,
                  hasData: !!appResponse.data,
                  error: appResponse.error,
                });
                if (appResponse.success && appResponse.data) {
                  // Direct user assignment found - use full details
                  allApps.push({
                    id: appResponse.data.id || link.appInstanceId,
                    appId: link.appInstanceId,
                    scope: 'USER' as const,
                    created: appResponse.data.created || new Date().toISOString(),
                    lastUpdated: appResponse.data.lastUpdated || new Date().toISOString(),
                    status: appResponse.data.status || 'ACTIVE',
                    profile: appResponse.data.profile || {},
                    credentials: appResponse.data.credentials,
                    _embedded: {
                      app: {
                        id: link.appInstanceId,
                        label: link.label,
                        name: link.appName,
                      } as any,
                    },
                  });
                } else {
                  // API returned non-success (e.g., 404 for group-based assignment)
                  // Include basic info from appLinks - user may be assigned via group
                  // Note: We still return this as UserAppAssignment since it came from the user's appLinks,
                  // even though the underlying assignment may be group-based
                  console.log(`[useOktaApi] User ${userId} may be assigned to app ${link.appInstanceId} via group (no direct assignment found)`);
                  allApps.push({
                    id: link.appInstanceId,
                    appId: link.appInstanceId,
                    scope: 'USER' as const,
                    created: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    status: 'ACTIVE',
                    profile: {},
                    _embedded: {
                      app: {
                        id: link.appInstanceId,
                        label: link.label,
                        name: link.appName,
                      } as any,
                    },
                  });
                }
              } catch {
                // If we can't get details, still include basic info
                allApps.push({
                  id: link.appInstanceId,
                  appId: link.appInstanceId,
                  scope: 'USER' as const,
                  created: new Date().toISOString(),
                  lastUpdated: new Date().toISOString(),
                  status: 'ACTIVE',
                  profile: {},
                  _embedded: {
                    app: {
                      id: link.appInstanceId,
                      label: link.label,
                      name: link.appName,
                    } as any,
                  },
                });
              }
            } else {
              // Basic info only
              allApps.push({
                id: link.appInstanceId,
                appId: link.appInstanceId,
                scope: 'USER' as const,
                created: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                status: 'ACTIVE',
                profile: {},
                _embedded: {
                  app: {
                    id: link.appInstanceId,
                    label: link.label,
                    name: link.appName,
                  } as any,
                },
              });
            }
          }

          // Check for next page using Link header
          const linkHeader = response.headers?.['link'] || response.headers?.['Link'];
          if (linkHeader && linkHeader.includes('rel="next"')) {
            const links = linkHeader.split(',');
            for (const link of links) {
              if (link.includes('rel="next"')) {
                const match = link.match(/<([^>]+)>/);
                if (match) {
                  const fullUrl = new URL(match[1]);
                  nextUrl = fullUrl.pathname + fullUrl.search;
                  break;
                }
              }
            }
            if (!nextUrl || nextUrl === `/api/v1/users/${userId}/appLinks`) {
              nextUrl = null;
            }
          } else {
            nextUrl = null;
          }
        } else {
          break;
        }
      }

      console.log('[useOktaApi] getUserApps returning', allApps.length, 'apps');
      return allApps;
    } catch (error) {
      console.error(`[useOktaApi] Failed to get apps for user ${userId}:`, error);
      throw error;
    }
  };

  /**
   * Get all apps assigned to a group (with pagination)
   */
  const getGroupApps = async (groupId: string, expand?: boolean): Promise<GroupAppAssignment[]> => {
    try {
      const allApps: GroupAppAssignment[] = [];
      const expandParam = expand ? '?expand=app' : '';
      let nextUrl: string | null = `/api/v1/groups/${groupId}/apps${expandParam}`;
      const initialUrl = nextUrl;

      while (nextUrl) {
        const response = await coreApi.makeApiRequest(nextUrl);
        if (response.success && response.data) {
          const apps = Array.isArray(response.data) ? response.data : [response.data];
          allApps.push(...apps);

          // Check for next page using Link header
          const linkHeader = response.headers?.['link'] || response.headers?.['Link'];
          if (linkHeader && linkHeader.includes('rel="next"')) {
            // Parse the Link header to extract the next URL
            const links = linkHeader.split(',');
            nextUrl = null;
            for (const link of links) {
              if (link.includes('rel="next"')) {
                const match = link.match(/<([^>]+)>/);
                if (match) {
                  const fullUrl = new URL(match[1]);
                  nextUrl = fullUrl.pathname + fullUrl.search;
                  break;
                }
              }
            }
            // Prevent infinite loops
            if (nextUrl === initialUrl) {
              nextUrl = null;
            }
          } else {
            nextUrl = null;
          }
        } else {
          break;
        }
      }

      return allApps;
    } catch (error) {
      console.error(`[useOktaApi] Failed to get apps for group ${groupId}:`, error);
      throw error;
    }
  };

  /**
   * Get a specific user's assignment to an app
   */
  const getUserAppAssignment = async (appId: string, userId: string): Promise<UserAppAssignment | null> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/apps/${appId}/users/${userId}`);
      if (response.success && response.data) {
        return { ...response.data, scope: 'USER' as const };
      }
      return null;
    } catch (error) {
      console.error(`[useOktaApi] Failed to get user assignment for app ${appId}, user ${userId}:`, error);
      return null;
    }
  };

  /**
   * Get a specific group's assignment to an app
   */
  const getGroupAppAssignment = async (appId: string, groupId: string): Promise<GroupAppAssignment | null> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/apps/${appId}/groups/${groupId}`);
      if (response.success && response.data) {
        return { ...response.data, scope: 'GROUP' as const };
      }
      return null;
    } catch (error) {
      console.error(`[useOktaApi] Failed to get group assignment for app ${appId}, group ${groupId}:`, error);
      return null;
    }
  };

  /**
   * Get app details including schema
   */
  const getAppDetails = async (
    appId: string,
    includeSchema: boolean = false
  ): Promise<{ app: OktaApp; schema?: AppProfileSchema }> => {
    try {
      const appResponse = await coreApi.makeApiRequest(`/api/v1/apps/${appId}`);
      if (!appResponse.success || !appResponse.data) {
        throw new Error('Failed to fetch app details');
      }

      const result: { app: OktaApp; schema?: AppProfileSchema } = {
        app: appResponse.data,
      };

      if (includeSchema) {
        const schemaResponse = await coreApi.makeApiRequest(`/api/v1/meta/schemas/apps/${appId}/default`);
        if (schemaResponse.success && schemaResponse.data) {
          result.schema = schemaResponse.data;
        }
      }

      return result;
    } catch (error) {
      console.error(`[useOktaApi] Failed to get app details for ${appId}:`, error);
      throw error;
    }
  };

  /**
   * Assign a user to an app
   */
  const assignUserToApp = async (
    appId: string,
    userId: string,
    assignmentData?: CreateAppAssignmentRequest
  ): Promise<UserAppAssignment> => {
    try {
      const body: any = {
        id: userId,
        scope: 'USER',
        ...(assignmentData?.profile && { profile: assignmentData.profile }),
        ...(assignmentData?.credentials && { credentials: assignmentData.credentials }),
      };

      const response = await coreApi.makeApiRequest(`/api/v1/apps/${appId}/users`, 'POST', body);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to assign user to app');
      }

      // Log to audit
      const currentUser = await coreApi.getCurrentUser();
      const appDetails = await getAppDetails(appId);
      await auditStore.logOperation({
        action: 'assign_user_to_app' as any,
        groupId: 'N/A',
        groupName: 'N/A',
        performedBy: currentUser.email,
        affectedUsers: [userId],
        result: 'success',
        details: {
          usersSucceeded: 1,
          usersFailed: 0,
          apiRequestCount: 1,
          durationMs: 0,
        },
        appId,
        appName: appDetails.app.label,
      } as any);

      return { ...response.data, scope: 'USER' as const };
    } catch (error) {
      console.error(`[useOktaApi] Failed to assign user ${userId} to app ${appId}:`, error);
      throw error;
    }
  };

  /**
   * Assign a group to an app
   */
  const assignGroupToApp = async (
    appId: string,
    groupId: string,
    assignmentData?: CreateAppAssignmentRequest
  ): Promise<GroupAppAssignment> => {
    try {
      const body: any = {
        priority: assignmentData?.priority ?? 0,
        ...(assignmentData?.profile && { profile: assignmentData.profile }),
      };

      const response = await coreApi.makeApiRequest(`/api/v1/apps/${appId}/groups/${groupId}`, 'PUT', body);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to assign group to app');
      }

      // Log to audit
      const currentUser = await coreApi.getCurrentUser();
      const appDetails = await getAppDetails(appId);
      const groupResponse = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`);
      await auditStore.logOperation({
        action: 'assign_group_to_app' as any,
        groupId,
        groupName: groupResponse.data?.profile?.name || groupId,
        performedBy: currentUser.email,
        affectedUsers: [],
        result: 'success',
        details: {
          usersSucceeded: 0,
          usersFailed: 0,
          apiRequestCount: 1,
          durationMs: 0,
        },
        appId,
        appName: appDetails.app.label,
      } as any);

      return { ...response.data, scope: 'GROUP' as const };
    } catch (error) {
      console.error(`[useOktaApi] Failed to assign group ${groupId} to app ${appId}:`, error);
      throw error;
    }
  };

  /**
   * Remove a user from an app
   */
  const removeUserFromApp = async (appId: string, userId: string): Promise<boolean> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/apps/${appId}/users/${userId}`, 'DELETE');
      const success = response.success;

      // Log to audit
      const currentUser = await coreApi.getCurrentUser();
      const appDetails = await getAppDetails(appId);
      await auditStore.logOperation({
        action: 'remove_user_from_app' as any,
        groupId: 'N/A',
        groupName: 'N/A',
        performedBy: currentUser.email,
        affectedUsers: [userId],
        result: success ? 'success' : 'failed',
        details: {
          usersSucceeded: success ? 1 : 0,
          usersFailed: success ? 0 : 1,
          apiRequestCount: 1,
          durationMs: 0,
        },
        appId,
        appName: appDetails.app.label,
      } as any);

      return success;
    } catch (error) {
      console.error(`[useOktaApi] Failed to remove user ${userId} from app ${appId}:`, error);
      throw error;
    }
  };

  /**
   * Remove a group from an app
   */
  const removeGroupFromApp = async (appId: string, groupId: string): Promise<boolean> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/apps/${appId}/groups/${groupId}`, 'DELETE');
      const success = response.success;

      // Log to audit
      const currentUser = await coreApi.getCurrentUser();
      const appDetails = await getAppDetails(appId);
      const groupResponse = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`);
      await auditStore.logOperation({
        action: 'remove_group_from_app' as any,
        groupId,
        groupName: groupResponse.data?.profile?.name || groupId,
        performedBy: currentUser.email,
        affectedUsers: [],
        result: success ? 'success' : 'failed',
        details: {
          usersSucceeded: 0,
          usersFailed: 0,
          apiRequestCount: 1,
          durationMs: 0,
        },
        appId,
        appName: appDetails.app.label,
      } as any);

      return success;
    } catch (error) {
      console.error(`[useOktaApi] Failed to remove group ${groupId} from app ${appId}:`, error);
      throw error;
    }
  };

  /**
   * Get app profile schema for validation
   */
  const getAppProfileSchema = async (appId: string): Promise<Record<string, any> | null> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/apps/${appId}`);
      if (response.success && response.data) {
        return response.data.settings?.app || response.data.credentials?.scheme || null;
      }
      return null;
    } catch {
      return null;
    }
  };

  /**
   * Preview conversion without making changes
   */
  const previewConversion = async (
    userId: string,
    targetGroupId: string,
    appId: string
  ): Promise<{
    userProfile: Record<string, any>;
    groupProfile: Record<string, any>;
    mergedProfile: Record<string, any>;
    differences: Array<{
      field: string;
      userValue: any;
      groupValue: any;
      mergedValue: any;
      fieldType: string;
    }>;
    warnings: string[];
  }> => {
    const userAssignment = await getUserAppAssignment(appId, userId);
    const existingGroupAssignment = await getGroupAppAssignment(appId, targetGroupId);

    const userProfile = userAssignment?.profile || {};
    const groupProfile = existingGroupAssignment?.profile || {};
    const mergedProfile = deepMergeProfiles(groupProfile, userProfile, 'merge');

    const warnings: string[] = [];
    const differences: Array<{
      field: string;
      userValue: any;
      groupValue: any;
      mergedValue: any;
      fieldType: string;
    }> = [];

    // Analyze all fields
    const allKeys = new Set([...Object.keys(userProfile), ...Object.keys(groupProfile)]);
    allKeys.forEach((key) => {
      const uVal = userProfile[key];
      const gVal = groupProfile[key];
      const mVal = mergedProfile[key];

      // Determine field type
      let fieldType = 'string';
      if (Array.isArray(uVal) || Array.isArray(gVal)) fieldType = 'array';
      else if (typeof uVal === 'object' || typeof gVal === 'object') fieldType = 'object';
      else if (typeof uVal === 'boolean' || typeof gVal === 'boolean') fieldType = 'boolean';

      // Check if there's a difference
      const isDifferent = JSON.stringify(uVal) !== JSON.stringify(gVal);
      if (isDifferent) {
        differences.push({
          field: key,
          userValue: uVal,
          groupValue: gVal,
          mergedValue: mVal,
          fieldType,
        });
      }
    });

    // Add warnings
    if (userAssignment?.credentials) {
      warnings.push(
        'User has stored credentials that cannot be transferred to group assignment. User may need to re-authenticate.'
      );
    }
    if (!existingGroupAssignment) {
      warnings.push('This will create a new group assignment to the app.');
    }
    if (differences.some((d) => d.fieldType === 'array')) {
      warnings.push('Profile contains array fields (like permission sets). Arrays will be merged, not replaced.');
    }

    return {
      userProfile,
      groupProfile,
      mergedProfile,
      differences,
      warnings,
    };
  };

  /**
   * FEATURE 2: Convert user app assignments to group assignments
   */
  const convertUserToGroupAssignment = async (
    request: AssignmentConversionRequest
  ): Promise<AssignmentConversionResult[]> => {
    const results: AssignmentConversionResult[] = [];
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    try {
      coreApi.callbacks.onResult?.('Starting user-to-group assignment conversion...', 'info');

      for (let i = 0; i < request.appIds.length; i++) {
        const appId = request.appIds[i];
        coreApi.checkCancelled();

        try {
          // Get user's direct assignment to the app
          // Note: This returns null if user is assigned via group, not directly
          const userAssignment = await getUserAppAssignment(appId, request.userId);
          if (!userAssignment) {
            // Try to get app name for better error message
            let appName = 'Unknown';
            try {
              const appDetails = await getAppDetails(appId);
              appName = appDetails.app.label || appDetails.app.name || appId;
            } catch {
              // Ignore error, use default name
            }
            results.push({
              appId,
              appName,
              success: false,
              error: 'No direct user assignment found. User may be assigned via group membership, which cannot be converted.',
            });
            failCount++;
            continue;
          }

          // Get app details for name
          const appDetails = await getAppDetails(appId);

          // Check if group assignment already exists
          const existingGroupAssignment = await getGroupAppAssignment(appId, request.targetGroupId);

          // Filter user-specific profile properties that can't be set on group assignments
          const userSpecificFields = new Set([
            'email',
            'emailType',
            'displayName',
            'givenName',
            'familyName',
            'firstName',
            'lastName',
            'login',
            'secondEmail',
            'middleName',
            'honorificPrefix',
            'honorificSuffix',
            'title',
            'nickName',
            'profileUrl',
            'primaryPhone',
            'mobilePhone',
            'streetAddress',
            'city',
            'state',
            'zipCode',
            'countryCode',
            'postalAddress',
            'preferredLanguage',
            'locale',
            'timezone',
            'userType',
            'employeeNumber',
            'costCenter',
            'organization',
            'division',
            'department',
            'managerId',
            'manager',
          ]);

          const filterUserSpecificFields = (profile: Record<string, any>): Record<string, any> => {
            const filtered: Record<string, any> = {};
            for (const [key, value] of Object.entries(profile)) {
              if (!userSpecificFields.has(key)) {
                filtered[key] = value;
              }
            }
            return filtered;
          };

          let mergedProfile: Record<string, any> | undefined;
          const userProfile = filterUserSpecificFields(userAssignment.profile || {});
          const groupProfile = existingGroupAssignment?.profile || {};

          const profileChanges: any = {
            userProfile,
            groupProfile,
            differences: [],
            credentialsHandled: !!userAssignment.credentials,
            hasArrayFields: false,
            hasNestedObjects: false,
          };

          // Detect complex fields
          [...Object.values(userProfile), ...Object.values(groupProfile)].forEach((val) => {
            if (Array.isArray(val)) profileChanges.hasArrayFields = true;
            if (val && typeof val === 'object' && !Array.isArray(val)) profileChanges.hasNestedObjects = true;
          });

          if (userAssignment.profile || existingGroupAssignment?.profile) {
            // Find differences with type information
            const allKeys = new Set([...Object.keys(userProfile), ...Object.keys(groupProfile)]);
            allKeys.forEach((key) => {
              const uVal = userProfile[key];
              const gVal = groupProfile[key];
              if (JSON.stringify(uVal) !== JSON.stringify(gVal)) {
                profileChanges.differences.push({
                  field: key,
                  userValue: uVal,
                  groupValue: gVal,
                  isArray: Array.isArray(uVal) || Array.isArray(gVal),
                  isObject:
                    (typeof uVal === 'object' && !Array.isArray(uVal)) ||
                    (typeof gVal === 'object' && !Array.isArray(gVal)),
                });
              }
            });

            // Apply merge strategy with deep merge support
            switch (request.mergeStrategy) {
              case 'preserve_user':
                // Keep existing group profile, don't modify
                mergedProfile = existingGroupAssignment?.profile;
                break;
              case 'prefer_user':
                // Deep merge with user profile taking precedence
                mergedProfile = deepMergeProfiles(groupProfile, userProfile, 'merge');
                break;
              case 'prefer_default':
                // Use group profile or empty if new
                mergedProfile = groupProfile;
                break;
            }
          }

          // Create or update group assignment
          const groupAssignment = await assignGroupToApp(appId, request.targetGroupId, {
            profile: mergedProfile,
            priority: 0,
          });

          // Remove user assignment if requested
          let userAssignmentRemoved = false;
          if (request.removeUserAssignment) {
            userAssignmentRemoved = await removeUserFromApp(appId, request.userId);
          }

          results.push({
            appId,
            appName: appDetails.app.label,
            success: true,
            userAssignment,
            groupAssignment,
            profileChanges,
            userAssignmentRemoved,
          });

          successCount++;
          coreApi.callbacks.onProgress?.(i + 1, request.appIds.length, `Converted ${appDetails.app.label}`);
        } catch (error: any) {
          results.push({
            appId,
            appName: 'Unknown',
            success: false,
            error: error.message || 'Unknown error',
          });
          failCount++;
        }
      }

      // Log to audit
      const currentUser = await coreApi.getCurrentUser();
      const groupResponse = await coreApi.makeApiRequest(`/api/v1/groups/${request.targetGroupId}`);
      const targetGroupName = groupResponse.data?.profile?.name || request.targetGroupId;

      await auditStore.logOperation({
        action: 'convert_assignment' as any,
        groupId: request.targetGroupId,
        groupName: targetGroupName,
        performedBy: currentUser.email,
        affectedUsers: [request.userId],
        result: failCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
        details: {
          usersSucceeded: successCount,
          usersFailed: failCount,
          apiRequestCount: request.appIds.length * 3, // Approximate
          durationMs: Date.now() - startTime,
        },
        conversionDetails: {
          sourceType: 'user',
          targetType: 'group',
          assignmentsConverted: successCount,
        },
      } as any);

      // Log to undo manager (only if at least one conversion succeeded)
      if (successCount > 0) {
        // Get user details for undo
        const userResponse = await coreApi.makeApiRequest(`/api/v1/users/${request.userId}`);
        const userProfile = userResponse.data?.profile;
        const userEmail = userProfile?.email || userProfile?.login || request.userId;
        const userName = userProfile?.firstName && userProfile?.lastName
          ? `${userProfile.firstName} ${userProfile.lastName}`
          : userEmail;

        // Build list of successfully converted apps with their profile data
        const convertedApps: ConversionAppInfo[] = results
          .filter(r => r.success)
          .map(r => ({
            appId: r.appId,
            appName: r.appName,
            profileData: r.userAssignment?.profile
          }));

        await logConvertUserToGroupAssignmentAction(
          request.userId,
          userEmail,
          userName,
          request.targetGroupId,
          targetGroupName,
          convertedApps,
          request.removeUserAssignment
        );
      }

      coreApi.callbacks.onResult?.(
        `Conversion complete: ${successCount} succeeded, ${failCount} failed`,
        failCount === 0 ? 'success' : successCount > 0 ? 'warning' : 'error'
      );
    } catch (error: any) {
      coreApi.callbacks.onResult?.(`Conversion failed: ${error.message}`, 'error');
      throw error;
    }

    return results;
  };

  /**
   * FEATURE 3: Copy user app assignments to another user
   */
  const copyUserToUserAssignment = async (
    sourceUserId: string,
    targetUserId: string,
    appIds: string[],
    mergeStrategy: 'preserve_user' | 'prefer_user' | 'prefer_default'
  ): Promise<AssignmentConversionResult[]> => {
    const results: AssignmentConversionResult[] = [];
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    try {
      coreApi.callbacks.onResult?.('Starting user-to-user app assignment copy...', 'info');

      for (let i = 0; i < appIds.length; i++) {
        const appId = appIds[i];
        coreApi.checkCancelled();

        try {
          // Get source user's assignment to the app
          const sourceAssignment = await getUserAppAssignment(appId, sourceUserId);
          if (!sourceAssignment) {
            let appName = 'Unknown';
            try {
              const appDetails = await getAppDetails(appId);
              appName = appDetails.app.label || appDetails.app.name || appId;
            } catch {
              // Ignore error
            }
            results.push({
              appId,
              appName,
              success: false,
              error: 'No direct assignment found for source user. User may be assigned via group.',
            });
            failCount++;
            continue;
          }

          // Get app details
          const appDetails = await getAppDetails(appId);

          // Check if target user already has an assignment
          const existingTargetAssignment = await getUserAppAssignment(appId, targetUserId);

          // Filter out user-specific profile fields that Okta auto-populates from user profile
          const userSpecificFields = new Set([
            'email',
            'emailType',
            'displayName',
            'givenName',
            'familyName',
            'firstName',
            'lastName',
            'login',
            'secondEmail',
            'middleName',
            'honorificPrefix',
            'honorificSuffix',
            'title',
            'nickName',
            'profileUrl',
            'primaryPhone',
            'mobilePhone',
            'streetAddress',
            'city',
            'state',
            'zipCode',
            'countryCode',
            'postalAddress',
            'preferredLanguage',
            'locale',
            'timezone',
            'userType',
            'employeeNumber',
            'costCenter',
            'organization',
            'division',
            'department',
            'managerId',
            'manager',
          ]);

          const filterUserSpecificFields = (profile: Record<string, any>): Record<string, any> => {
            const filtered: Record<string, any> = {};
            for (const [key, value] of Object.entries(profile)) {
              if (!userSpecificFields.has(key)) {
                filtered[key] = value;
              }
            }
            return filtered;
          };

          let mergedProfile: Record<string, any> | undefined;
          const sourceProfile = filterUserSpecificFields(sourceAssignment.profile || {});
          const targetProfile = existingTargetAssignment?.profile || {};

          const profileChanges: any = {
            userProfile: sourceProfile,
            groupProfile: targetProfile,
            differences: [],
            credentialsHandled: !!sourceAssignment.credentials,
            hasArrayFields: false,
            hasNestedObjects: false,
          };

          // Detect complex fields
          [...Object.values(sourceProfile), ...Object.values(targetProfile)].forEach((val) => {
            if (Array.isArray(val)) profileChanges.hasArrayFields = true;
            if (val && typeof val === 'object' && !Array.isArray(val)) profileChanges.hasNestedObjects = true;
          });

          if (sourceAssignment.profile || existingTargetAssignment?.profile) {
            // Find differences
            const allKeys = new Set([...Object.keys(sourceProfile), ...Object.keys(targetProfile)]);
            allKeys.forEach((key) => {
              const sVal = sourceProfile[key];
              const tVal = targetProfile[key];
              if (JSON.stringify(sVal) !== JSON.stringify(tVal)) {
                profileChanges.differences.push({
                  field: key,
                  userValue: sVal,
                  groupValue: tVal,
                  isArray: Array.isArray(sVal) || Array.isArray(tVal),
                  isObject:
                    (typeof sVal === 'object' && !Array.isArray(sVal)) ||
                    (typeof tVal === 'object' && !Array.isArray(tVal)),
                });
              }
            });

            // Apply merge strategy
            switch (mergeStrategy) {
              case 'preserve_user':
                // Keep existing target user profile (don't change anything)
                // If target doesn't have an assignment yet, use empty profile
                mergedProfile = existingTargetAssignment?.profile || {};
                break;
              case 'prefer_user': {
                // Merge ONLY non-personal fields
                // Filter out personal fields from target profile too
                const targetNonPersonalFields = filterUserSpecificFields(targetProfile);
                // Merge: source profile (already filtered) takes precedence over target non-personal fields
                const merged = deepMergeProfiles(targetNonPersonalFields, sourceProfile, 'merge');

                // Add back target user's personal fields (email, name, etc.)
                const targetPersonalFields: Record<string, unknown> = {};
                if (targetProfile) {
                  for (const [key, value] of Object.entries(targetProfile)) {
                    if (userSpecificFields.has(key)) {
                      targetPersonalFields[key] = value;
                    }
                  }
                }
                // Combine: personal fields + merged non-personal fields
                mergedProfile = { ...merged, ...targetPersonalFields };
                break;
              }
              case 'prefer_default': {
                // Use default (empty) profile - but preserve target user's personal fields
                // Get target user's personal fields that should never be removed
                const personalOnly: Record<string, unknown> = {};
                if (targetProfile) {
                  for (const [key, value] of Object.entries(targetProfile)) {
                    if (userSpecificFields.has(key)) {
                      personalOnly[key] = value;
                    }
                  }
                }
                mergedProfile = personalOnly;
                break;
              }
            }
          }

          // Create or update target user's assignment
          const targetAssignment = await assignUserToApp(appId, targetUserId, {
            profile: mergedProfile,
          });

          results.push({
            appId,
            appName: appDetails.app.label,
            success: true,
            userAssignment: sourceAssignment,
            groupAssignment: targetAssignment as any, // Reusing the type
            profileChanges,
            userAssignmentRemoved: false, // We never remove source assignments in user-to-user
          });

          successCount++;
          coreApi.callbacks.onProgress?.(i + 1, appIds.length, `Copied ${appDetails.app.label}`);
        } catch (error: any) {
          results.push({
            appId,
            appName: 'Unknown',
            success: false,
            error: error.message || 'Unknown error',
          });
          failCount++;
        }
      }

      // Log to audit
      const currentUser = await coreApi.getCurrentUser();
      const sourceUserResponse = await coreApi.makeApiRequest(`/api/v1/users/${sourceUserId}`);
      const targetUserResponse = await coreApi.makeApiRequest(`/api/v1/users/${targetUserId}`);

      await auditStore.logOperation({
        action: 'copy_user_assignments' as any,
        groupId: targetUserId, // Using groupId field for target user
        groupName: `${targetUserResponse.data?.profile?.firstName} ${targetUserResponse.data?.profile?.lastName}`,
        performedBy: currentUser.email,
        affectedUsers: [sourceUserId, targetUserId],
        result: failCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
        details: {
          usersSucceeded: successCount,
          usersFailed: failCount,
          apiRequestCount: appIds.length * 3,
          durationMs: Date.now() - startTime,
        },
        conversionDetails: {
          sourceType: 'user',
          targetType: 'user',
          assignmentsConverted: successCount,
          sourceUserName: `${sourceUserResponse.data?.profile?.firstName} ${sourceUserResponse.data?.profile?.lastName}`,
          targetUserName: `${targetUserResponse.data?.profile?.firstName} ${targetUserResponse.data?.profile?.lastName}`,
        },
      } as any);

      // TODO: Add undo logging for user-to-user copy

      coreApi.callbacks.onResult?.(
        `Copy complete: ${successCount} succeeded, ${failCount} failed`,
        failCount === 0 ? 'success' : successCount > 0 ? 'warning' : 'error'
      );
    } catch (error: any) {
      coreApi.callbacks.onResult?.(`Copy failed: ${error.message}`, 'error');
      throw error;
    }

    return results;
  };

  /**
   * FEATURE 4: Bulk assign groups to apps
   */
  const bulkAssignGroupsToApps = async (request: BulkAppAssignmentRequest): Promise<BulkAppAssignmentResult> => {
    const results: any[] = [];
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;
    const totalOperations = request.groupIds.length * request.appIds.length;

    try {
      coreApi.callbacks.onResult?.(`Starting bulk assignment: ${totalOperations} total operations...`, 'info');

      let current = 0;
      for (const groupId of request.groupIds) {
        coreApi.checkCancelled();

        // Get group details
        const groupResponse = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`);
        const groupName = groupResponse.data?.profile?.name || groupId;

        for (const appId of request.appIds) {
          coreApi.checkCancelled();
          current++;

          try {
            // Get app details
            const appDetails = await getAppDetails(appId);

            // Determine profile: app-specific > default
            const profile = request.perAppProfiles?.[appId] || request.profile;

            // Assign group to app
            const assignment = await assignGroupToApp(appId, groupId, {
              profile,
              priority: request.priority ?? 0,
            });

            results.push({
              groupId,
              groupName,
              appId,
              appName: appDetails.app.label,
              success: true,
              assignment,
            });

            successCount++;
            coreApi.callbacks.onProgress?.(
              current,
              totalOperations,
              `Assigned ${groupName} to ${appDetails.app.label}`
            );
          } catch (error: any) {
            const appDetails = await getAppDetails(appId).catch(() => ({ app: { label: 'Unknown' } }));
            results.push({
              groupId,
              groupName,
              appId,
              appName: appDetails.app.label,
              success: false,
              error: error.message || 'Unknown error',
            });
            failCount++;
            coreApi.callbacks.onProgress?.(current, totalOperations, `Failed: ${groupName} to ${appDetails.app.label}`);
          }
        }
      }

      // Log to audit
      const currentUser = await coreApi.getCurrentUser();
      await auditStore.logOperation({
        action: 'bulk_app_assignment' as any,
        groupId: 'multiple',
        groupName: `${request.groupIds.length} groups`,
        performedBy: currentUser.email,
        affectedUsers: [],
        affectedApps: request.appIds,
        result: failCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
        details: {
          usersSucceeded: successCount,
          usersFailed: failCount,
          apiRequestCount: totalOperations,
          durationMs: Date.now() - startTime,
        },
      } as any);

      coreApi.callbacks.onResult?.(
        `Bulk assignment complete: ${successCount}/${totalOperations} succeeded`,
        failCount === 0 ? 'success' : successCount > 0 ? 'warning' : 'error'
      );
    } catch (error: any) {
      coreApi.callbacks.onResult?.(`Bulk assignment failed: ${error.message}`, 'error');
      throw error;
    }

    return {
      totalOperations,
      successful: successCount,
      failed: failCount,
      results,
    };
  };

  /**
   * FEATURE 3: App assignment security analysis wrapper
   */
  const analyzeAppAssignmentSecurity = async (
    userId?: string,
    groupId?: string
  ): Promise<AppAssignmentSecurityAnalysis> => {
    coreApi.callbacks.onResult?.('Starting app assignment security analysis...', 'info');
    const startTime = Date.now();

    try {
      // Import getUserLastLogin from userOperations
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

      const analysis = await analyzeAppSecurity(
        userId,
        groupId,
        getUserApps,
        getGroupApps,
        coreApi.makeApiRequest,
        getUserLastLogin
      );

      // Log to audit
      const currentUser = await coreApi.getCurrentUser();
      await auditStore.logOperation({
        action: 'app_security_scan' as any,
        groupId: groupId || 'N/A',
        groupName: groupId ? 'Group Analysis' : 'User Analysis',
        performedBy: currentUser.email,
        affectedUsers: userId ? [userId] : [],
        result: 'success',
        details: {
          usersSucceeded: 0,
          usersFailed: 0,
          apiRequestCount: analysis.totalAppsAnalyzed,
          durationMs: Date.now() - startTime,
        },
      } as any);

      coreApi.callbacks.onResult?.(
        `Security analysis complete: ${analysis.findings.length} findings, risk score ${analysis.riskScore}/100`,
        analysis.riskScore > 70 ? 'error' : analysis.riskScore > 40 ? 'warning' : 'success'
      );

      return analysis;
    } catch (error: any) {
      coreApi.callbacks.onResult?.(`Security analysis failed: ${error.message}`, 'error');
      throw error;
    }
  };

  /**
   * FEATURE 5: App assignment recommender wrapper
   */
  const getAppAssignmentRecommender = async (appIds: string[]): Promise<AssignmentRecommenderResult> => {
    coreApi.callbacks.onResult?.('Analyzing app assignments and generating recommendations...', 'info');

    try {
      const result = await getAppAssignmentRecommendations(appIds, coreApi.makeApiRequest);

      coreApi.callbacks.onResult?.(
        `Recommendations ready: Found ${result.recommendations.length} apps with optimization opportunities. ` +
          `Potential ${result.overallStats.estimatedMaintenanceReduction.toFixed(0)}% reduction in direct assignments.`,
        'success'
      );

      return result;
    } catch (error: any) {
      coreApi.callbacks.onResult?.(`Failed to generate recommendations: ${error.message}`, 'error');
      throw error;
    }
  };

  /**
   * Fetches push group mappings for an application
   */
  const getAppPushGroupMappings = async (
    appId: string
  ): Promise<
    Array<{
      mappingId: string;
      sourceUserGroupId: string;
      targetGroupId?: string;
      status: string;
    }>
  > => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/apps/${appId}/group-push/mappings?limit=200`);
      console.log(`[useOktaApi] getAppPushGroupMappings for ${appId}:`, {
        success: response.success,
        dataLength: response.data?.length,
        rawData: response.data,
      });
      if (!response.success || !response.data) {
        return [];
      }
      const mappings = response.data.map((mapping: any) => ({
        mappingId: mapping.mappingId || mapping.id,
        sourceUserGroupId: mapping.sourceGroupId || mapping.sourceUserGroupId, // API uses sourceGroupId
        targetGroupId: mapping.targetGroupId,
        status: mapping.status || 'UNKNOWN',
      }));
      console.log(`[useOktaApi] Parsed mappings for ${appId}:`, mappings);
      return mappings;
    } catch (error) {
      console.warn(`[useOktaApi] Failed to get push group mappings for app ${appId}:`, error);
      return [];
    }
  };

  /**
   * Get application certificate details (for SAML apps)
   * Returns certificate expiration info from /api/v1/apps/{appId}/credentials/keys
   */
  const getAppCertificates = async (appId: string): Promise<{
    kid: string;
    created: string;
    lastUpdated: string;
    expiresAt: string;
    x5c: string[];
    kty: string;
    use: string;
  }[]> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/apps/${appId}/credentials/keys`);
      if (!response.success || !response.data) {
        return [];
      }
      return Array.isArray(response.data) ? response.data : [response.data];
    } catch (error) {
      console.warn(`[useOktaApi] Failed to get certificates for app ${appId}:`, error);
      return [];
    }
  };

  /**
   * Get application provisioning features
   * Returns features like USER_PROVISIONING, INBOUND_PROVISIONING, GROUP_PUSH
   */
  const getAppFeatures = async (appId: string): Promise<{
    name: string;
    status: string;
    description?: string;
    capabilities?: any;
  }[]> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/apps/${appId}/features`);
      if (!response.success || !response.data) {
        return [];
      }
      return Array.isArray(response.data) ? response.data : [response.data];
    } catch (error) {
      console.warn(`[useOktaApi] Failed to get features for app ${appId}:`, error);
      return [];
    }
  };

  /**
   * Get assignment counts for an app (paginated)
   * Returns { userCount, groupCount, totalCount }
   */
  const getAppAssignmentCounts = async (appId: string): Promise<{
    userCount: number;
    groupCount: number;
    totalCount: number;
  }> => {
    try {
      let userCount = 0;
      let groupCount = 0;

      // Count users (paginate through all)
      let nextUrl: string | null = `/api/v1/apps/${appId}/users?limit=200`;
      while (nextUrl) {
        const response = await coreApi.makeApiRequest(nextUrl);
        if (response.success && response.data) {
          const users = Array.isArray(response.data) ? response.data : [response.data];
          userCount += users.length;

          // Check for next page
          const linkHeader = response.headers?.link || response.headers?.Link;
          if (linkHeader && typeof linkHeader === 'string') {
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            nextUrl = nextMatch ? nextMatch[1] : null;
          } else {
            nextUrl = null;
          }
        } else {
          break;
        }
      }

      // Count groups (paginate through all)
      nextUrl = `/api/v1/apps/${appId}/groups?limit=200`;
      while (nextUrl) {
        const response = await coreApi.makeApiRequest(nextUrl);
        if (response.success && response.data) {
          const groups = Array.isArray(response.data) ? response.data : [response.data];
          groupCount += groups.length;

          // Check for next page
          const linkHeader = response.headers?.link || response.headers?.Link;
          if (linkHeader && typeof linkHeader === 'string') {
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            nextUrl = nextMatch ? nextMatch[1] : null;
          } else {
            nextUrl = null;
          }
        } else {
          break;
        }
      }

      return {
        userCount,
        groupCount,
        totalCount: userCount + groupCount,
      };
    } catch (error) {
      console.error(`[useOktaApi] Failed to get assignment counts for app ${appId}:`, error);
      return { userCount: 0, groupCount: 0, totalCount: 0 };
    }
  };

  /**
   * Enrich a single app with detailed data from additional API calls
   * Fetches certificates, features, and assignment counts
   */
  const enrichApp = async (app: OktaApp): Promise<AppSummary> => {
    try {
      console.log(`[useOktaApi] Enriching app ${app.id} (${app.label})`);

      // Run all enrichment calls in parallel
      const [certificates, features, counts, pushGroupMappings] = await Promise.all([
        getAppCertificates(app.id),
        getAppFeatures(app.id),
        getAppAssignmentCounts(app.id),
        getAppPushGroupMappings(app.id),
      ]);

      // Process certificate data
      let certStatus: AppSummary['certStatus'] = 'NOT_APPLICABLE';
      let certExpiresAt: string | undefined;
      let certDaysRemaining: number | undefined;

      const appType = app.signOnMode?.toUpperCase() || '';
      if ((appType.includes('SAML_2') || appType.includes('SAML_1')) && certificates.length > 0) {
        // Use the first signing certificate
        const cert = certificates.find(c => c.use === 'sig') || certificates[0];
        if (cert && cert.expiresAt) {
          certExpiresAt = cert.expiresAt;
          const expirationDate = new Date(cert.expiresAt);
          const now = new Date();
          const daysRemaining = Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          certDaysRemaining = Math.max(0, daysRemaining);

          if (daysRemaining < 0) {
            certStatus = 'EXPIRED';
          } else if (daysRemaining <= 30) {
            certStatus = 'EXPIRING_SOON';
          } else {
            certStatus = 'ACTIVE';
          }
        }
      }

      // Process provisioning features
      let provisioningStatus: AppSummary['provisioningStatus'] = 'NOT_SUPPORTED';
      let provisioningType: AppSummary['provisioningType'] | undefined;

      const userProvisioningFeature = features.find(f =>
        f.name === 'USER_PROVISIONING' || f.name === 'PROVISIONING'
      );
      const inboundProvisioningFeature = features.find(f => f.name === 'INBOUND_PROVISIONING');

      if (userProvisioningFeature) {
        if (userProvisioningFeature.status === 'ENABLED') {
          provisioningStatus = 'ENABLED';
          // Check for SCIM in capabilities
          if (userProvisioningFeature.capabilities?.includes?.('SCIM') || app.name?.toLowerCase().includes('scim')) {
            provisioningType = 'SCIM';
          } else {
            provisioningType = 'PROFILE_MASTERING';
          }
        } else {
          provisioningStatus = 'DISABLED';
        }
      } else if (inboundProvisioningFeature) {
        if (inboundProvisioningFeature.status === 'ENABLED') {
          provisioningStatus = 'ENABLED';
          provisioningType = 'IMPORT';
        } else {
          provisioningStatus = 'DISABLED';
        }
      }

      // Process push groups
      const pushGroupsEnabled = pushGroupMappings.length > 0 ||
        features.some(f => (f.name === 'GROUP_PUSH' || f.name === 'PUSH_GROUPS') && f.status === 'ENABLED');
      const pushGroupsCount = pushGroupMappings.length > 0 ? pushGroupMappings.length : undefined;
      const pushGroupsErrors = pushGroupMappings.filter(m => m.status === 'ERROR' || m.status === 'FAILED').length || undefined;

      // Build enriched app summary (importing enrichAppBasic for consistency)
      const { enrichAppBasic } = await import('../../utils/appEnrichment');
      const basicEnriched = enrichAppBasic(app);

      return {
        ...basicEnriched,
        // Override with real data
        userAssignmentCount: counts.userCount,
        groupAssignmentCount: counts.groupCount,
        totalAssignmentCount: counts.totalCount,
        provisioningStatus,
        provisioningType,
        pushGroupsEnabled,
        pushGroupsCount,
        pushGroupsErrors,
        certStatus,
        certExpiresAt,
        certDaysRemaining,
        hasActiveUsers: counts.userCount > 0,
        hasInactiveUsers: false, // Would need additional API calls to determine
      };
    } catch (error) {
      console.error(`[useOktaApi] Failed to enrich app ${app.id}:`, error);
      // Fall back to basic enrichment
      const { enrichAppBasic } = await import('../../utils/appEnrichment');
      return enrichAppBasic(app);
    }
  };

  return {
    getAllApps,
    getUserApps,
    getGroupApps,
    getUserAppAssignment,
    getGroupAppAssignment,
    getAppDetails,
    assignUserToApp,
    assignGroupToApp,
    removeUserFromApp,
    removeGroupFromApp,
    getAppProfileSchema,
    previewConversion,
    convertUserToGroupAssignment,
    copyUserToUserAssignment,
    bulkAssignGroupsToApps,
    analyzeAppAssignmentSecurity,
    getAppAssignmentRecommender,
    getAppPushGroupMappings,
    getAppCertificates,
    getAppFeatures,
    getAppAssignmentCounts,
    enrichApp,
  };
}
