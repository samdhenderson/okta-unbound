import React, { useState, useEffect } from 'react';
import StatCard from './shared/StatCard';
import QuickActionsPanel, { type ActionSection } from './shared/QuickActionsPanel';
import { UserProfileCard } from '../users';
import { useUserMemberships } from '../../hooks/useUserMemberships';
import AlertMessage from '../shared/AlertMessage';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import type { OktaUser } from '../../../shared/types';

interface UserOverviewProps {
  userId: string;
  userName?: string;
  targetTabId: number;
  onTabChange: (tab: 'users') => void;
}

const UserOverview: React.FC<UserOverviewProps> = ({
  userId,
  targetTabId,
  onTabChange,
}) => {
  const [userDetails, setUserDetails] = useState<OktaUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the shared hook for consistent membership analysis
  const {
    memberships: groups,
    isLoading: isLoadingMemberships,
    error: membershipError,
    loadMemberships,
  } = useUserMemberships({ targetTabId });

  const isLoading = isLoadingUser || isLoadingMemberships;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoadingUser(true);
        setError(null);

        // Fetch user details
        const userResponse = await chrome.tabs.sendMessage(targetTabId, {
          action: 'getUserDetails',
          userId,
        });

        if (userResponse.success && userResponse.data) {
          setUserDetails(userResponse.data);
          // Load memberships using the shared hook (includes proper rule analysis)
          await loadMemberships(userResponse.data);
        } else {
          setError(userResponse.error || 'Failed to load user details');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user data');
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId, targetTabId, loadMemberships]);

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading user data..." centered />;
  }

  const displayError = error || membershipError;
  if (displayError) {
    return (
      <AlertMessage
        message={{ text: displayError, type: 'error' }}
      />
    );
  }

  const directGroups = groups.filter(g => g.membershipType === 'DIRECT').length;
  const ruleBasedGroups = groups.filter(g => g.membershipType === 'RULE_BASED').length;
  const unknownGroups = groups.filter(g => g.membershipType === 'UNKNOWN').length;
  const totalGroups = groups.length;

  // Only include actions that actually work - removed "coming soon" placeholders
  const actionSections: ActionSection[] = [
    {
      title: 'Group Management',
      icon: 'users',
      expanded: true,
      actions: [
        {
          label: 'View All Groups',
          icon: 'list',
          variant: 'primary',
          onClick: () => onTabChange('users'),
          badge: `${totalGroups}`,
          tooltip: 'See full list of group memberships',
        },
      ],
    },
    {
      title: 'Analysis',
      icon: 'search',
      expanded: false,
      actions: [
        {
          label: 'Trace Memberships',
          icon: 'link',
          variant: 'ghost',
          onClick: () => onTabChange('users'),
          tooltip: 'Analyze how user got into each group',
        },
      ],
    },
  ];

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
        />
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Groups"
          value={totalGroups}
          color="primary"
          icon="users"
        />
        <StatCard
          title="Direct Assignments"
          value={directGroups}
          color="neutral"
          icon="hand"
          subtitle="*Approximate"
        />
        <StatCard
          title="Rule-Based"
          value={ruleBasedGroups}
          color="neutral"
          icon="bolt"
          subtitle="*Approximate"
        />
        <StatCard
          title="Status"
          value={userDetails?.status || 'Unknown'}
          color={statusColors[userDetails?.status || ''] || 'neutral'}
          icon="chart"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <QuickActionsPanel sections={actionSections} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Group Membership Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Group Membership Distribution</h3>
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="text-5xl font-bold text-[#007dc1]">{totalGroups}</div>
                <div className="text-gray-600 mt-2">Total Groups</div>
                <div className="mt-4 flex gap-4 justify-center text-sm">
                  {unknownGroups === totalGroups ? (
                    <div>
                      <span className="font-semibold text-gray-900">{totalGroups}</span>
                      <span className="text-gray-600"> Total</span>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="font-semibold text-gray-900">{directGroups}</span>
                        <span className="text-gray-600"> Direct</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">{ruleBasedGroups}</span>
                        <span className="text-gray-600"> Rule-Based</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Groups */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Groups</h3>
              <Button variant="ghost" size="sm" onClick={() => onTabChange('users')}>
                View All
              </Button>
            </div>
            <div className="space-y-2">
              {groups.slice(0, 5).map((membership, index) => (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">
                      {membership.group?.profile?.name || 'Unknown Group'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {membership.membershipType === 'DIRECT' ? 'Direct Assignment' :
                        membership.membershipType === 'RULE_BASED' ? 'Rule-Based' : 'Group'}
                    </div>
                  </div>
                  <span className={`
                    px-2 py-1 rounded text-xs font-medium
                    ${membership.membershipType === 'DIRECT' ? 'bg-blue-100 text-blue-800' :
                      membership.membershipType === 'RULE_BASED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                  `}>
                    {membership.membershipType === 'DIRECT' ? 'Manual' :
                      membership.membershipType === 'RULE_BASED' ? 'Auto' : 'Member'}
                  </span>
                </div>
              ))}
              {groups.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No group memberships found
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserOverview;
