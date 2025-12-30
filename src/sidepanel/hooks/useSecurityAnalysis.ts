import { useState, useCallback } from 'react';
import type {
  OktaUser,
  OktaUserWithLastLogin,
  OrphanedAccount,
  StaleGroupMembership,
  SecurityPosture,
  SecurityFinding,
  SecurityRecommendation,
  SecurityScanCache,
  OktaGroupRule,
} from '../../shared/types';

const CACHE_KEY = 'security_scan_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface UseSecurityAnalysisOptions {
  onProgress?: (current: number, total: number, message: string) => void;
  fetchUserMetadata?: boolean; // Whether to fetch app assignments and group memberships (slow for large groups)
}

export function useSecurityAnalysis({ onProgress, fetchUserMetadata = false }: UseSecurityAnalysisOptions) {
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, message: '' });

  // Helper to update progress
  const updateProgress = useCallback(
    (current: number, total: number, message: string) => {
      setScanProgress({ current, total, message });
      onProgress?.(current, total, message);
    },
    [onProgress]
  );

  // Calculate days since a date
  const daysSince = useCallback((date: Date | null): number | null => {
    if (!date) return null;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, []);

  // Detect orphaned accounts
  const detectOrphanedAccounts = useCallback(
    async (
      groupMembers: OktaUser[],
      userDetailsMap: Map<string, OktaUserWithLastLogin>,
      getUserAppAssignments?: (userId: string) => Promise<number>,
      getUserGroupMemberships?: (userId: string) => Promise<number>
    ): Promise<OrphanedAccount[]> => {
      const orphanedAccounts: OrphanedAccount[] = [];

      updateProgress(0, groupMembers.length, 'Analyzing user accounts...');

      for (let i = 0; i < groupMembers.length; i++) {
        const member = groupMembers[i];
        const userDetails = userDetailsMap.get(member.id);

        if (!userDetails) continue;

        const lastLogin = userDetails.lastLogin ? new Date(userDetails.lastLogin) : null;
        const created = userDetails.created ? new Date(userDetails.created) : null;
        const neverLoggedIn = !lastLogin;
        const daysSinceLogin = lastLogin ? daysSince(lastLogin) : null;
        const daysSinceCreation = created ? daysSince(created) : null;

        let orphanReason: OrphanedAccount['orphanReason'] | null = null;
        let riskLevel: OrphanedAccount['riskLevel'] = 'low';

        // Determine if this is an orphaned account and its risk level
        if (member.status === 'DEPROVISIONED') {
          orphanReason = 'deprovisioned_in_groups';
          riskLevel = 'critical';
        } else if (neverLoggedIn && daysSinceCreation !== null && daysSinceCreation > 30) {
          orphanReason = 'never_logged_in';
          riskLevel = 'high';
        } else if (daysSinceLogin !== null && daysSinceLogin >= 180) {
          orphanReason = 'inactive_180d';
          riskLevel = 'high';
        } else if (daysSinceLogin !== null && daysSinceLogin >= 90) {
          orphanReason = 'inactive_90d';
          riskLevel = 'medium';
        }

        // Only add to orphaned accounts if we found a reason
        if (orphanReason) {
          // Optionally fetch app assignments and group memberships if callbacks provided
          let appAssignments = 0;
          let groupMemberships = 0;

          if (fetchUserMetadata && getUserAppAssignments && getUserGroupMemberships) {
            try {
              updateProgress(i + 1, groupMembers.length, `Fetching metadata for user ${i + 1}/${groupMembers.length}...`);
              [appAssignments, groupMemberships] = await Promise.all([
                getUserAppAssignments(member.id),
                getUserGroupMemberships(member.id)
              ]);
            } catch (error) {
              console.error(`[useSecurityAnalysis] Failed to fetch metadata for user ${member.id}:`, error);
            }
          }

          orphanedAccounts.push({
            userId: member.id,
            email: member.profile.email,
            firstName: member.profile.firstName,
            lastName: member.profile.lastName,
            status: member.status,
            lastLogin,
            daysSinceLogin,
            neverLoggedIn,
            groupMemberships,
            appAssignments,
            orphanReason,
            riskLevel,
            membershipSource: 'direct', // Would need rule analysis to determine
          });
        }

        updateProgress(i + 1, groupMembers.length, `Analyzed ${i + 1} of ${groupMembers.length} users`);
      }

      return orphanedAccounts;
    },
    [daysSince, updateProgress, fetchUserMetadata]
  );

  // Analyze stale memberships
  const analyzeStaleMemberships = useCallback(
    async (
      groupMembers: OktaUser[],
      userDetailsMap: Map<string, OktaUserWithLastLogin>,
      _ruleInfo: OktaGroupRule[]
    ): Promise<StaleGroupMembership[]> => {
      const staleMemberships: StaleGroupMembership[] = [];

      updateProgress(0, groupMembers.length, 'Analyzing membership staleness...');

      for (let i = 0; i < groupMembers.length; i++) {
        const member = groupMembers[i];
        const userDetails = userDetailsMap.get(member.id);

        if (!userDetails) continue;

        const created = userDetails.created ? new Date(userDetails.created) : null;
        const daysInGroup = created ? daysSince(created) : null;

        // For now, we'll flag direct adds older than 90 days for review
        // In a full implementation, we'd need to determine if the user was added directly or via rules
        const shouldReview = daysInGroup !== null && daysInGroup > 90;

        if (shouldReview) {
          staleMemberships.push({
            userId: member.id,
            email: member.profile.email,
            firstName: member.profile.firstName,
            lastName: member.profile.lastName,
            // Note: Okta API doesn't provide "added to group" date
            // Using user creation date as proxy (see OKTA_API_LIMITATIONS.md §1)
            userCreatedDate: created,
            daysSinceCreated: daysInGroup,
            source: 'direct', // Heuristic approximation (see OKTA_API_LIMITATIONS.md §2)
            lastAppUsage: null, // Not available from API (see OKTA_API_LIMITATIONS.md §6)
            shouldReview,
            matchesRules: true, // Would need rule evaluation
          });
        }

        updateProgress(i + 1, groupMembers.length, `Analyzed ${i + 1} of ${groupMembers.length} memberships`);
      }

      return staleMemberships;
    },
    [daysSince, updateProgress]
  );

  // Calculate overall security posture
  const calculateSecurityPosture = useCallback(
    (
      groupId: string,
      groupName: string,
      orphanedAccounts: OrphanedAccount[],
      staleMemberships: StaleGroupMembership[]
    ): SecurityPosture => {
      const findings: SecurityFinding[] = [];
      const recommendations: SecurityRecommendation[] = [];

      // Count orphaned accounts by severity
      const criticalOrphans = orphanedAccounts.filter((a) => a.riskLevel === 'critical');
      const highOrphans = orphanedAccounts.filter((a) => a.riskLevel === 'high');
      const mediumOrphans = orphanedAccounts.filter((a) => a.riskLevel === 'medium');

      if (criticalOrphans.length > 0) {
        findings.push({
          severity: 'critical',
          category: 'orphaned_accounts',
          count: criticalOrphans.length,
          description: `${criticalOrphans.length} deprovisioned user(s) still in group`,
          affectedUsers: criticalOrphans.map((a) => a.userId),
        });

        recommendations.push({
          title: 'Remove Deprovisioned Users',
          description:
            'Deprovisioned users should be immediately removed from all groups to prevent security risks.',
          priority: 'high',
          actionable: true,
          relatedFinding: 'orphaned_accounts',
        });
      }

      if (highOrphans.length > 0) {
        const neverLoggedIn = highOrphans.filter((a) => a.orphanReason === 'never_logged_in');
        const inactive180 = highOrphans.filter((a) => a.orphanReason === 'inactive_180d');

        if (neverLoggedIn.length > 0) {
          findings.push({
            severity: 'high',
            category: 'orphaned_accounts',
            count: neverLoggedIn.length,
            description: `${neverLoggedIn.length} user(s) never logged in (30+ days old)`,
            affectedUsers: neverLoggedIn.map((a) => a.userId),
          });
        }

        if (inactive180.length > 0) {
          findings.push({
            severity: 'high',
            category: 'orphaned_accounts',
            count: inactive180.length,
            description: `${inactive180.length} user(s) inactive for 180+ days`,
            affectedUsers: inactive180.map((a) => a.userId),
          });
        }

        recommendations.push({
          title: 'Review Inactive and Never-Used Accounts',
          description:
            'Users who have never logged in or been inactive for 6+ months may be orphaned accounts that should be reviewed.',
          priority: 'high',
          actionable: true,
          relatedFinding: 'orphaned_accounts',
        });
      }

      if (mediumOrphans.length > 0) {
        findings.push({
          severity: 'medium',
          category: 'orphaned_accounts',
          count: mediumOrphans.length,
          description: `${mediumOrphans.length} user(s) inactive for 90-179 days`,
          affectedUsers: mediumOrphans.map((a) => a.userId),
        });

        recommendations.push({
          title: 'Monitor 90+ Day Inactive Users',
          description:
            'Users inactive for 90+ days should be monitored and may need to be removed if inactivity continues.',
          priority: 'medium',
          actionable: true,
          relatedFinding: 'orphaned_accounts',
        });
      }

      if (staleMemberships.length > 0) {
        findings.push({
          severity: 'medium',
          category: 'stale_memberships',
          count: staleMemberships.length,
          description: `${staleMemberships.length} membership(s) older than 90 days should be reviewed`,
          affectedUsers: staleMemberships.map((m) => m.userId),
        });

        recommendations.push({
          title: 'Review Long-Standing Memberships',
          description: 'Memberships older than 90 days should be reviewed to ensure they are still necessary.',
          priority: 'medium',
          actionable: true,
          relatedFinding: 'stale_memberships',
        });
      }

      // Calculate overall score (0-100, higher is better)
      let score = 100;
      score -= criticalOrphans.length * 20; // -20 per critical
      score -= highOrphans.length * 10; // -10 per high
      score -= mediumOrphans.length * 5; // -5 per medium
      score -= Math.min(staleMemberships.length * 2, 20); // -2 per stale, max -20
      score = Math.max(0, Math.min(100, score));

      return {
        overallScore: score,
        findings,
        recommendations,
        lastScanDate: new Date(),
        groupId,
        groupName,
      };
    },
    []
  );

  // Load cached scan results
  const loadCachedScan = useCallback(async (groupId: string): Promise<SecurityScanCache | null> => {
    try {
      const result = await chrome.storage.local.get([CACHE_KEY]);
      const cache = result[CACHE_KEY] as SecurityScanCache | undefined;

      if (cache && cache.groupId === groupId) {
        const age = Date.now() - cache.timestamp;
        if (age < CACHE_TTL) {
          // Convert date strings back to Date objects for orphaned accounts
          const orphanedAccounts = cache.orphanedAccounts.map(account => ({
            ...account,
            lastLogin: account.lastLogin ? new Date(account.lastLogin) : null,
          }));

          // Convert date strings back to Date objects for stale memberships
          const staleMemberships = cache.staleMemberships.map(membership => ({
            ...membership,
            userCreatedDate: membership.userCreatedDate ? new Date(membership.userCreatedDate) : null,
          }));

          // Convert lastScanDate for posture
          const posture: SecurityPosture = {
            ...cache.posture,
            lastScanDate: new Date(cache.posture.lastScanDate),
          };

          return {
            ...cache,
            orphanedAccounts,
            staleMemberships,
            posture,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[useSecurityAnalysis] Failed to load cached scan:', error);
      return null;
    }
  }, []);

  // Save scan results to cache
  const saveScanToCache = useCallback(async (cache: SecurityScanCache): Promise<void> => {
    try {
      await chrome.storage.local.set({ [CACHE_KEY]: cache });
    } catch (error) {
      console.error('[useSecurityAnalysis] Failed to save scan to cache:', error);
    }
  }, []);

  // Clear cache
  const clearCache = useCallback(async (): Promise<void> => {
    try {
      await chrome.storage.local.remove([CACHE_KEY]);
    } catch (error) {
      console.error('[useSecurityAnalysis] Failed to clear cache:', error);
    }
  }, []);

  return {
    scanProgress,
    detectOrphanedAccounts,
    analyzeStaleMemberships,
    calculateSecurityPosture,
    loadCachedScan,
    saveScanToCache,
    clearCache,
  };
}
