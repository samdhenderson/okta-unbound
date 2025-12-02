// Utility for calculating group staleness scores
import type { GroupSummary } from '../types';

export interface StalenessConfig {
  membershipThresholdDays: number; // Default: 180 (6 months)
  emptyGroupWeight: number; // Default: 40 points
  noActivityWeight: number; // Default: 30 points
  veryFewMembersWeight: number; // Default: 20 points
  stalenessThreshold: number; // Default: 50 (score >= this = stale)
}

export const DEFAULT_STALENESS_CONFIG: StalenessConfig = {
  membershipThresholdDays: 180, // 6 months
  emptyGroupWeight: 40,
  noActivityWeight: 30,
  veryFewMembersWeight: 20,
  stalenessThreshold: 50,
};

export interface StalenessResult {
  score: number;
  reasons: string[];
  isStale: boolean;
}

/**
 * Calculate the number of days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Calculate staleness score for a group
 * Returns a score from 0-100 where higher = more stale
 */
export function calculateStaleness(
  group: GroupSummary,
  config: StalenessConfig = DEFAULT_STALENESS_CONFIG
): StalenessResult {
  let score = 0;
  const reasons: string[] = [];
  const now = new Date();

  // Check membership updates
  if (group.lastMembershipUpdated) {
    const daysSinceUpdate = daysBetween(group.lastMembershipUpdated, now);
    if (daysSinceUpdate > config.membershipThresholdDays) {
      score += config.noActivityWeight;
      const monthsSinceUpdate = Math.floor(daysSinceUpdate / 30);
      reasons.push(`No membership changes in ${monthsSinceUpdate} months`);
    }
  } else if (group.created) {
    // If no lastMembershipUpdated, check against creation date as fallback
    const daysSinceCreation = daysBetween(group.created, now);
    if (daysSinceCreation > config.membershipThresholdDays) {
      score += config.noActivityWeight * 0.7; // Slightly lower weight since it's less certain
      const monthsSinceCreation = Math.floor(daysSinceCreation / 30);
      reasons.push(`Created ${monthsSinceCreation} months ago with no tracked membership updates`);
    }
  }

  // Check member count
  if (group.memberCount === 0) {
    score += config.emptyGroupWeight;
    reasons.push('Group is empty');
  } else if (group.memberCount <= 2) {
    score += config.veryFewMembersWeight;
    reasons.push(`Only ${group.memberCount} member${group.memberCount > 1 ? 's' : ''}`);
  }

  // Additional factor: No rules could indicate manual management (less maintained)
  if (!group.hasRules && group.memberCount > 0) {
    // Add a small penalty for manual groups (5 points)
    score += 5;
    reasons.push('No automated rules');
  }

  // Ensure score doesn't exceed 100
  score = Math.min(score, 100);

  return {
    score,
    reasons,
    isStale: score >= config.stalenessThreshold,
  };
}

/**
 * Format a relative time string (e.g., "3 months ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const days = daysBetween(date, now);

  if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 30) {
    return `${days} days ago`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(days / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
}

/**
 * Apply staleness calculation to a group and return updated group
 */
export function applyStalenessScore(
  group: GroupSummary,
  config?: StalenessConfig
): GroupSummary {
  const result = calculateStaleness(group, config);
  return {
    ...group,
    stalenessScore: result.score,
    stalenessReasons: result.reasons,
    isStale: result.isStale,
  };
}
