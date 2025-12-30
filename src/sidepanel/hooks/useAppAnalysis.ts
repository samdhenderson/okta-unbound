import type {
  AppAssignmentSecurityAnalysis,
  AssignmentRecommenderResult,
  OktaUser,
  OktaGroup,
  UserAppAssignment,
  GroupAppAssignment,
  AppSecurityFinding,
  OverProvisionedUser,
  OrphanedAppAssignment,
  RedundantAssignment,
  AppAssignmentRecommendation,
  RecommendedGroupAssignment,
  AssignmentTypeDistribution,
} from '../../shared/types';

/**
 * FEATURE 3: App Assignment Security Analysis
 * Analyzes app assignments for security issues
 */
export async function analyzeAppSecurity(
  userId: string | undefined,
  groupId: string | undefined,
  getUserApps: (userId: string) => Promise<UserAppAssignment[]>,
  getGroupApps: (groupId: string) => Promise<GroupAppAssignment[]>,
  makeApiRequest: (endpoint: string, method?: string, body?: any, priority?: any) => Promise<any>,
  _getUserLastLogin: (userId: string) => Promise<Date | null>
): Promise<AppAssignmentSecurityAnalysis> {
  const findings: AppSecurityFinding[] = [];
  const overProvisionedUsers: OverProvisionedUser[] = [];
  const orphanedAppAssignments: OrphanedAppAssignment[] = [];
  const redundantAssignments: RedundantAssignment[] = [];
  let totalDirectAssignments = 0;
  let totalGroupAssignments = 0;
  let totalAppsAnalyzed = 0;

  // Circuit breaker for consecutive failures
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 2;

  try {
    if (userId) {
      // Analyze specific user's app assignments
      const userApps = await getUserApps(userId);
      totalAppsAnalyzed = userApps.length;

      // Get user details
      const userResponse = await makeApiRequest(`/api/v1/users/${userId}`);
      const user: OktaUser = userResponse.data;

      // Get user's groups to check for group-based assignments
      const userGroupsResponse = await makeApiRequest(`/api/v1/users/${userId}/groups`);
      const userGroups: OktaGroup[] = userGroupsResponse.data || [];

      // Check each app assignment
      for (const appAssignment of userApps) {
        const appId = appAssignment.id;

        // Check if user has group-based assignment to same app
        let hasGroupAssignment = false;
        const groupAssignments: Array<{ group: OktaGroup; assignment: GroupAppAssignment }> = [];

        // Batch check group assignments with rate limiting
        let requestCount = 0;
        const MAX_REQUESTS_PER_APP = 20; // Limit requests per app to prevent API flooding

        for (const group of userGroups) {
          // Safety limit: Don't check more than MAX_REQUESTS_PER_APP groups per app
          if (requestCount >= MAX_REQUESTS_PER_APP) {
            console.warn(`[Security Analysis] Reached max group checks (${MAX_REQUESTS_PER_APP}) for app ${appId}`);
            break;
          }

          try {
            const groupAppResponse = await makeApiRequest(`/api/v1/apps/${appId}/groups/${group.id}`);
            requestCount++;

            if (groupAppResponse.success && groupAppResponse.data) {
              hasGroupAssignment = true;
              groupAssignments.push({
                group,
                assignment: { ...groupAppResponse.data, scope: 'GROUP' as const },
              });
              totalGroupAssignments++;
              consecutiveFailures = 0; // Reset on success
            } else if (!groupAppResponse.success && groupAppResponse.status !== 404) {
              // Non-404 errors count as failures (404 just means group not assigned to app)
              consecutiveFailures++;
            }

            // Add small delay between requests to avoid rate limiting
            if (requestCount < userGroups.length && requestCount % 5 === 0) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          } catch (error) {
            requestCount++;
            consecutiveFailures++;
            // Group not assigned to app or request failed, continue
            console.debug(`[Security Analysis] Failed to check group ${group.id} for app ${appId}:`, error);
          }

          // Circuit breaker: Stop if too many consecutive failures
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.error(`[Security Analysis] Circuit breaker triggered after ${MAX_CONSECUTIVE_FAILURES} consecutive failures. Stopping group checks for app ${appId}.`);
            findings.push({
              severity: 'high',
              category: 'stale_credential',
              title: 'Analysis Incomplete - API Errors',
              description: `Security analysis was interrupted due to ${MAX_CONSECUTIVE_FAILURES} consecutive API failures while checking group assignments. Some group assignments may not have been checked.`,
              recommendation: 'Retry the analysis later or check your API connectivity and rate limits. This may indicate API throttling or permission issues.',
              affectedUsers: [userId || ''],
              affectedApps: [appId],
            });
            break; // Break out of group loop for this app
          }
        }

        // Count direct assignments
        if (appAssignment.scope === 'USER') {
          totalDirectAssignments++;
        }

        // Check for redundant assignments (both direct and group)
        if (hasGroupAssignment && appAssignment.scope === 'USER') {
          const profileDifferences = groupAssignments.some(
            (ga) => JSON.stringify(ga.assignment.profile) !== JSON.stringify(appAssignment.profile)
          );
          const credentialsDifferent = !!appAssignment.credentials;

          redundantAssignments.push({
            userId: user.id,
            userEmail: user.profile.email,
            userName: `${user.profile.firstName} ${user.profile.lastName}`,
            appId,
            appName: appAssignment._embedded?.app?.label || appId,
            directAssignment: appAssignment as UserAppAssignment,
            groupAssignments,
            profileDifferences,
            credentialsDifferent,
            recommendation: credentialsDifferent
              ? 'keep_both'
              : profileDifferences
                ? 'keep_both'
                : 'remove_direct',
          });
        }

        // Check for orphaned assignments
        if (user.status === 'DEPROVISIONED' || user.status === 'SUSPENDED') {
          orphanedAppAssignments.push({
            userId: user.id,
            userEmail: user.profile.email,
            userName: `${user.profile.firstName} ${user.profile.lastName}`,
            userStatus: user.status,
            appId,
            appName: appAssignment._embedded?.app?.label || appId,
            assignment: appAssignment as UserAppAssignment,
            reason: user.status === 'DEPROVISIONED' ? 'user_deprovisioned' : 'user_inactive',
            recommendRemoval: true,
          });
        }
      }

      // Check if user is over-provisioned
      if (totalDirectAssignments > 0 && totalGroupAssignments > 0) {
        overProvisionedUsers.push({
          userId: user.id,
          userEmail: user.profile.email,
          userName: `${user.profile.firstName} ${user.profile.lastName}`,
          directAppAssignments: totalDirectAssignments,
          groupBasedAppAssignments: totalGroupAssignments,
          appsWithBothTypes: redundantAssignments.map((r) => r.appId),
          suggestedRemoval: redundantAssignments
            .filter((r) => r.recommendation === 'remove_direct')
            .map((r) => r.appId),
        });
      }
    } else if (groupId) {
      // Analyze group's app assignments
      const groupApps = await getGroupApps(groupId);
      totalAppsAnalyzed = groupApps.length;
      totalGroupAssignments = groupApps.length;

      // Get group members to check for over-provisioning
      const membersResponse = await makeApiRequest(`/api/v1/groups/${groupId}/users?limit=200`);
      const members: OktaUser[] = membersResponse.data || [];

      // For each member, check if they also have direct assignments
      for (const member of members.slice(0, 50)) {
        // Limit to first 50 for performance
        const memberApps = await getUserApps(member.id);
        const directAppIds = new Set(memberApps.filter((a) => a.scope === 'USER').map((a) => a.id));
        const groupAppIds = new Set(groupApps.map((a) => a.id));

        const overlap = [...directAppIds].filter((id) => groupAppIds.has(id));

        if (overlap.length > 0) {
          overProvisionedUsers.push({
            userId: member.id,
            userEmail: member.profile.email,
            userName: `${member.profile.firstName} ${member.profile.lastName}`,
            directAppAssignments: directAppIds.size,
            groupBasedAppAssignments: groupAppIds.size,
            appsWithBothTypes: overlap,
            suggestedRemoval: overlap,
          });
        }
      }

      totalDirectAssignments = overProvisionedUsers.reduce((sum, u) => sum + u.directAppAssignments, 0);
    }

    // Generate findings
    if (redundantAssignments.length > 0) {
      findings.push({
        severity: 'medium',
        category: 'redundant',
        title: 'Redundant App Assignments',
        description: `Found ${redundantAssignments.length} app(s) with both direct and group-based assignments`,
        affectedUsers: redundantAssignments.map((r) => r.userId),
        affectedApps: redundantAssignments.map((r) => r.appId),
        recommendation: 'Review redundant assignments and remove unnecessary direct assignments',
      });
    }

    if (orphanedAppAssignments.length > 0) {
      findings.push({
        severity: 'high',
        category: 'orphaned',
        title: 'Orphaned App Assignments',
        description: `Found ${orphanedAppAssignments.length} app assignment(s) for deprovisioned/suspended users`,
        affectedUsers: orphanedAppAssignments.map((o) => o.userId),
        affectedApps: orphanedAppAssignments.map((o) => o.appId),
        recommendation: 'Remove app assignments for deprovisioned users',
      });
    }

    if (overProvisionedUsers.length > 0) {
      findings.push({
        severity: 'medium',
        category: 'over_provisioned',
        title: 'Over-Provisioned Users',
        description: `Found ${overProvisionedUsers.length} user(s) with both direct and group-based app assignments`,
        affectedUsers: overProvisionedUsers.map((u) => u.userId),
        affectedApps: [],
        recommendation: 'Standardize on group-based assignments where possible',
      });
    }

    // Calculate risk score (0-100, higher is worse)
    let riskScore = 0;
    riskScore += orphanedAppAssignments.length * 10; // 10 points per orphaned assignment
    riskScore += redundantAssignments.length * 5; // 5 points per redundant assignment
    riskScore += overProvisionedUsers.length * 3; // 3 points per over-provisioned user
    riskScore = Math.min(100, riskScore);

    const assignmentTypeDistribution: AssignmentTypeDistribution = {
      totalAssignments: totalDirectAssignments + totalGroupAssignments,
      directAssignments: totalDirectAssignments,
      groupAssignments: totalGroupAssignments,
      ruleBasedAssignments: 0,
      percentageDirect: totalDirectAssignments / (totalDirectAssignments + totalGroupAssignments || 1) * 100,
      percentageGroup: totalGroupAssignments / (totalDirectAssignments + totalGroupAssignments || 1) * 100,
      percentageRule: 0,
    };

    return {
      groupId,
      userId,
      findings,
      overProvisionedUsers,
      orphanedAppAssignments,
      redundantAssignments,
      assignmentTypeDistribution,
      totalAppsAnalyzed,
      riskScore,
    };
  } catch (error) {
    console.error('[useAppAnalysis] Failed to analyze app security:', error);
    throw error;
  }
}

/**
 * FEATURE 5: App-to-Group Assignment Recommender
 * Analyzes app user assignments and recommends group assignments
 */
export async function getAppAssignmentRecommendations(
  appIds: string[],
  makeApiRequest: (endpoint: string, method?: string, body?: any, priority?: any) => Promise<any>
): Promise<AssignmentRecommenderResult> {
  const recommendations: AppAssignmentRecommendation[] = [];
  let totalDirectAssignments = 0;
  let potentialGroupAssignments = 0;

  try {
    for (const appId of appIds) {
      // Get all users assigned to the app
      const appUsersResponse = await makeApiRequest(`/api/v1/apps/${appId}/users?limit=200`);
      const appUsers: UserAppAssignment[] = appUsersResponse.data || [];
      const directUsers = appUsers.filter((u) => u.scope === 'USER');
      totalDirectAssignments += directUsers.length;

      if (directUsers.length === 0) {
        continue; // No direct assignments to optimize
      }

      // Get app details
      const appResponse = await makeApiRequest(`/api/v1/apps/${appId}`);
      const appName = appResponse.data?.label || appId;

      // Get all user IDs with direct assignments
      const userIds = directUsers.map((u) => u.id);

      // For each user, get their groups
      const userGroupMap = new Map<string, Set<string>>(); // userId -> Set<groupId>
      const groupUserMap = new Map<string, Set<string>>(); // groupId -> Set<userId>
      const groupInfoMap = new Map<string, OktaGroup>(); // groupId -> group

      for (const userId of userIds.slice(0, 100)) {
        // Limit for performance
        try {
          const userGroupsResponse = await makeApiRequest(`/api/v1/users/${userId}/groups`);
          const userGroups: OktaGroup[] = userGroupsResponse.data || [];

          const groupIds = new Set(userGroups.map((g) => g.id));
          userGroupMap.set(userId, groupIds);

          userGroups.forEach((group) => {
            if (!groupUserMap.has(group.id)) {
              groupUserMap.set(group.id, new Set());
              groupInfoMap.set(group.id, group);
            }
            groupUserMap.get(group.id)!.add(userId);
          });
        } catch (error) {
          console.error(`Failed to get groups for user ${userId}:`, error);
        }
      }

      // Find groups that cover many app users
      const groupCandidates: RecommendedGroupAssignment[] = [];

      for (const [groupId, groupUserIds] of groupUserMap.entries()) {
        const matchingUsers = groupUserIds.size;
        const percentageOfAppUsers = (matchingUsers / directUsers.length) * 100;

        // Only recommend if group covers at least 10% of app users
        if (percentageOfAppUsers >= 10) {
          const group = groupInfoMap.get(groupId)!;

          // Calculate suggested profile (most common profile values)
          const profileValues = new Map<string, Map<any, number>>();
          directUsers
            .filter((u) => groupUserIds.has(u.id))
            .forEach((u) => {
              if (u.profile) {
                Object.entries(u.profile).forEach(([key, value]) => {
                  if (!profileValues.has(key)) {
                    profileValues.set(key, new Map());
                  }
                  const counts = profileValues.get(key)!;
                  counts.set(value, (counts.get(value) || 0) + 1);
                });
              }
            });

          const suggestedProfile: Record<string, any> = {};
          profileValues.forEach((counts, key) => {
            const mostCommon = [...counts.entries()].reduce((a, b) => (a[1] > b[1] ? a : b))[0];
            suggestedProfile[key] = mostCommon;
          });

          groupCandidates.push({
            group,
            matchingUsers,
            percentageOfAppUsers,
            confidence: Math.min(100, percentageOfAppUsers * 1.5), // Boost confidence for higher coverage
            suggestedProfile: Object.keys(suggestedProfile).length > 0 ? suggestedProfile : undefined,
            suggestedPriority: 0,
            rationale: `Group "${group.profile.name}" contains ${matchingUsers} of ${directUsers.length} users (${percentageOfAppUsers.toFixed(1)}%) assigned to this app`,
          });
        }
      }

      // Sort by matching users
      groupCandidates.sort((a, b) => b.matchingUsers - a.matchingUsers);

      // Calculate coverage
      const coveredUserIds = new Set<string>();
      groupCandidates.forEach((gc) => {
        const groupUserIds = groupUserMap.get(gc.group.id)!;
        groupUserIds.forEach((uid) => coveredUserIds.add(uid));
      });

      const usersCoveredByRecommendations = coveredUserIds.size;
      const percentageCovered = (usersCoveredByRecommendations / directUsers.length) * 100;
      const usersStillNeedingDirectAssignment = userIds.filter((uid) => !coveredUserIds.has(uid));

      const estimatedReduction = percentageCovered;
      const implementationPriority =
        directUsers.length > 20 && percentageCovered > 70
          ? ('high' as const)
          : directUsers.length > 10 && percentageCovered > 50
            ? ('medium' as const)
            : ('low' as const);

      if (groupCandidates.length > 0) {
        potentialGroupAssignments += groupCandidates.length;

        recommendations.push({
          appId,
          appName,
          currentDirectAssignments: directUsers.length,
          recommendedGroupAssignments: groupCandidates.slice(0, 5), // Top 5
          coverageAnalysis: {
            totalAppUsers: directUsers.length,
            usersCoveredByRecommendations,
            percentageCovered,
            usersStillNeedingDirectAssignment,
            groupOverlaps: [],
          },
          estimatedReduction,
          implementationPriority,
        });
      }
    }

    // Sort recommendations by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.implementationPriority] - priorityOrder[b.implementationPriority]);

    const overallStats = {
      totalAppsAnalyzed: appIds.length,
      totalDirectAssignments,
      potentialGroupAssignments,
      estimatedAssignmentReduction: recommendations.reduce((sum, r) => sum + r.currentDirectAssignments, 0),
      estimatedMaintenanceReduction:
        totalDirectAssignments > 0
          ? (recommendations.reduce((sum, r) => sum + (r.estimatedReduction / 100) * r.currentDirectAssignments, 0) /
              totalDirectAssignments) *
            100
          : 0,
    };

    return {
      recommendations,
      overallStats,
      topRecommendations: recommendations.slice(0, 10),
    };
  } catch (error) {
    console.error('[useAppAnalysis] Failed to generate assignment recommendations:', error);
    throw error;
  }
}
