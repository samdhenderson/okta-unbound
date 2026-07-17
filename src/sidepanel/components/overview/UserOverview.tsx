/**
 * @module sidepanel/components/overview/UserOverview
 * @description Overview tab for a single Okta user: profile, membership stats, and quick actions.
 *
 * Fetches the user's details from the content script and their group
 * memberships via {@link useUserMemberships} (which classifies each as direct
 * vs. rule-based), then renders the profile card, stat cards, an alphabetical
 * groups preview (with Compare / View all), and the {@link UserComparisonModal}
 * launcher.
 */
import React, { useState, useEffect, useMemo } from 'react';
import StatCard from './shared/StatCard';
import { UserProfileCard, UserComparisonModal } from '../users';
import { useUserMemberships } from '../../hooks/useUserMemberships';
import { useEntityQuery } from '../../cache/useEntityQuery';
import AlertMessage from '../shared/AlertMessage';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import type { OktaUser } from '../../../shared/types';

/** Props for {@link UserOverview}. */
interface UserOverviewProps {
  /** Okta user id to load and summarize. */
  userId: string;
  /** Optional display name (currently informational; not read in render). */
  userName?: string;
  /** Browser tab hosting the Okta session; every API call is routed to it. */
  targetTabId: number;
  /** Open this user in the Users tab with their full membership list loaded. */
  onViewAllGroups: () => void;
  /** Okta org origin (unused for links here — the overview omits the Okta deep link). */
  oktaOrigin?: string | null;
}

/**
 * Renders the user Overview tab. Loads user details + memberships on mount /
 * user change and drives the profile card, stat grid, and comparison modal.
 */
const UserOverview: React.FC<UserOverviewProps> = ({
  userId,
  targetTabId,
  onViewAllGroups,
  oktaOrigin,
}) => {
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // User details from the shared entity cache: re-navigating back to this user
  // (or returning from another tab) serves instantly with no refetch.
  const {
    data: userDetails,
    isLoading: isLoadingUser,
    error: userError,
  } = useEntityQuery<OktaUser>(
    ['userDetails', userId],
    async () => {
      const userResponse = await chrome.tabs.sendMessage(targetTabId, {
        action: 'getUserDetails',
        userId,
      });
      if (!userResponse.success || !userResponse.data) {
        throw new Error(userResponse.error || 'Failed to load user details');
      }
      return userResponse.data as OktaUser;
    },
    { enabled: Boolean(targetTabId && userId) },
  );

  // Use the shared hook for consistent membership analysis (also cache-backed).
  const {
    memberships: groups,
    isLoading: isLoadingMemberships,
    error: membershipError,
    loadMemberships,
  } = useUserMemberships({ targetTabId });

  const isLoading = isLoadingUser || isLoadingMemberships;

  // Preview list: alphabetical by group name (a stable, honest ordering — the old
  // "Recent Groups" box was just the unsorted first five). Full list lives one tap
  // away via "View all". Kept above the early returns so hook order stays stable.
  const PREVIEW_LIMIT = 8;
  const sortedGroups = useMemo(
    () =>
      [...groups].sort((a, b) =>
        (a.group?.profile?.name || '').localeCompare(b.group?.profile?.name || ''),
      ),
    [groups],
  );

  // Load memberships once the user details are available (served from cache on
  // revisit). `userDetails`/`loadMemberships` are stable across renders.
  useEffect(() => {
    if (userDetails) loadMemberships(userDetails);
  }, [userDetails, loadMemberships]);

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading user data..." centered />;
  }

  const displayError = userError || membershipError;
  if (displayError) {
    return <AlertMessage message={{ text: displayError, type: 'danger' }} />;
  }

  const directGroups = groups.filter((g) => g.membershipType === 'DIRECT').length;
  const ruleBasedGroups = groups.filter((g) => g.membershipType === 'RULE_BASED').length;
  const totalGroups = groups.length;

  const statusColors: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
    ACTIVE: 'success',
    SUSPENDED: 'warning',
    DEPROVISIONED: 'error',
    LOCKED_OUT: 'error',
    PROVISIONED: 'neutral',
    STAGED: 'neutral',
    RECOVERY: 'warning',
    PASSWORD_EXPIRED: 'warning',
  };

  return (
    <div className="space-y-6">
      {/* User Profile Card - moved to the top */}
      {userDetails && (
        <UserProfileCard
          user={userDetails}
          groupCount={totalGroups}
          showCollapsibleSections={false}
          oktaOrigin={oktaOrigin}
          showOktaLink={false}
        />
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Total Groups" value={totalGroups} color="primary" icon="users" />
        <StatCard title="Direct Assignments" value={directGroups} color="neutral" icon="hand" />
        <StatCard title="Rule-Based" value={ruleBasedGroups} color="neutral" icon="bolt" />
        <StatCard
          title="Status"
          value={userDetails?.status || 'Unknown'}
          color={statusColors[userDetails?.status || ''] || 'neutral'}
          icon="chart"
        />
      </div>

      {/* Groups preview — the stat grid above already carries the Direct/Rule-Based
          split, so this is a concrete, alphabetical list (not another count box). */}
      <div className="bg-white rounded-md border border-neutral-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold text-neutral-900">Groups</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon="users"
              onClick={() => setIsCompareOpen(true)}
              title="Compare group & app access with another user"
            >
              Compare
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="list"
              onClick={onViewAllGroups}
              title="Open this user in the Users tab with all groups loaded"
            >
              View all
            </Button>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-sm">
            No group memberships found
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {sortedGroups.slice(0, PREVIEW_LIMIT).map((membership, index) => (
                <div
                  key={membership.group?.id || index}
                  className="flex items-center justify-between p-2 hover:bg-neutral-50 rounded-md"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-neutral-900 text-sm truncate">
                      {membership.group?.profile?.name || 'Unknown Group'}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {membership.membershipType === 'DIRECT'
                        ? 'Direct assignment'
                        : membership.membershipType === 'RULE_BASED'
                          ? 'Rule-based'
                          : 'Membership'}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-1 rounded-md text-xs font-medium ${
                      membership.membershipType === 'DIRECT'
                        ? 'bg-primary-light text-primary-text'
                        : membership.membershipType === 'RULE_BASED'
                          ? 'bg-success-light text-success-text'
                          : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    {membership.membershipType === 'DIRECT'
                      ? 'Manual'
                      : membership.membershipType === 'RULE_BASED'
                        ? 'Auto'
                        : 'Member'}
                  </span>
                </div>
              ))}
            </div>
            {totalGroups > PREVIEW_LIMIT && (
              <button
                type="button"
                onClick={onViewAllGroups}
                className="mt-3 w-full text-center text-xs font-medium text-primary-text hover:underline"
              >
                Showing {PREVIEW_LIMIT} of {totalGroups} — view all
              </button>
            )}
          </>
        )}
      </div>

      {/* User comparison modal */}
      {userDetails && (
        <UserComparisonModal
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          contextUser={userDetails}
          contextGroups={groups}
          targetTabId={targetTabId}
          onGroupsChanged={() => loadMemberships(userDetails, { force: true })}
        />
      )}
    </div>
  );
};

export default UserOverview;
