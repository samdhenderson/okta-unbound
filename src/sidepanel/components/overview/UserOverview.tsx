import React, { useState, useEffect } from 'react';
import StatCard from './shared/StatCard';
import QuickActionsPanel, { type ActionSection } from './shared/QuickActionsPanel';
import type { OktaUser, GroupMembership } from '../../../shared/types';

interface UserOverviewProps {
  userId: string;
  userName: string;
  targetTabId: number;
  onTabChange: (tab: 'users') => void;
}

const UserOverview: React.FC<UserOverviewProps> = ({
  userId,
  userName,
  targetTabId,
  onTabChange,
}) => {
  const [userDetails, setUserDetails] = useState<OktaUser | null>(null);
  const [groups, setGroups] = useState<GroupMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch user details
        const userResponse = await chrome.tabs.sendMessage(targetTabId, {
          action: 'getUserDetails',
          userId,
        });

        if (userResponse.success && userResponse.data) {
          setUserDetails(userResponse.data);
        }

        // Fetch user groups
        const groupsResponse = await chrome.tabs.sendMessage(targetTabId, {
          action: 'getUserGroups',
          userId,
        });

        if (groupsResponse.success && groupsResponse.data) {
          setGroups(groupsResponse.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [userId, targetTabId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-purple-600"></div>
          <p className="mt-4 text-gray-600">Loading user data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <div className="flex items-start">
          <span className="text-2xl mr-3">⚠️</span>
          <div>
            <h3 className="font-semibold text-red-900">Error loading user data</h3>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const directGroups = groups.filter(g => g.membershipType === 'DIRECT').length;
  const ruleBasedGroups = groups.filter(g => g.membershipType === 'RULE_BASED').length;
  const totalGroups = groups.length;

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
        {
          label: 'Add to Group',
          icon: 'plus',
          variant: 'secondary',
          onClick: () => alert('Add to group functionality - coming soon'),
          tooltip: 'Assign user to additional groups',
        },
        {
          label: 'Remove from Groups',
          icon: 'minus',
          variant: 'secondary',
          onClick: () => alert('Remove from groups - coming soon'),
          tooltip: 'Remove user from selected groups',
        },
      ],
    },
    {
      title: 'User Operations',
      icon: 'settings',
      expanded: false,
      actions: [
        {
          label: 'Reset Password',
          icon: 'key',
          variant: 'secondary',
          onClick: () => alert('Reset password - coming soon'),
          tooltip: 'Send password reset email',
        },
        {
          label: 'Suspend User',
          icon: 'pause',
          variant: 'danger',
          onClick: () => alert('Suspend user - coming soon'),
          disabled: userDetails?.status === 'SUSPENDED',
          tooltip: 'Temporarily suspend user account',
        },
        {
          label: 'Export User Data',
          icon: 'download',
          variant: 'secondary',
          onClick: () => alert('Export user data - coming soon'),
          tooltip: 'Export user profile and group memberships',
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
        {
          label: 'Security Scan',
          icon: 'shield',
          variant: 'ghost',
          onClick: () => alert('User security scan - coming soon'),
          tooltip: 'Check for security issues with this user',
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
        />
        <StatCard
          title="Rule-Based"
          value={ruleBasedGroups}
          color="neutral"
          icon="bolt"
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
          {/* User Profile Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Profile</h3>

            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-semibold text-gray-900">{userName}</h4>
                <p className="text-gray-600">{userDetails?.profile.email}</p>
                <span className={`
                  inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium
                  ${userDetails?.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                `}>
                  {userDetails?.status}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {userDetails?.lastLogin && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Last Login</span>
                  <span className="font-medium text-gray-900">
                    {new Date(userDetails.lastLogin).toLocaleDateString()}
                  </span>
                </div>
              )}
              {userDetails?.created && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Created</span>
                  <span className="font-medium text-gray-900">
                    {new Date(userDetails.created).toLocaleDateString()}
                  </span>
                </div>
              )}
              {userDetails?.profile.department && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Department</span>
                  <span className="font-medium text-gray-900">{userDetails.profile.department}</span>
                </div>
              )}
              {userDetails?.profile.title && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Title</span>
                  <span className="font-medium text-gray-900">{userDetails.profile.title}</span>
                </div>
              )}
            </div>
          </div>

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
                <div className="text-5xl font-bold text-purple-600">{totalGroups}</div>
                <div className="text-gray-600 mt-2">Total Groups</div>
                <div className="mt-4 flex gap-4 justify-center text-sm">
                  <div>
                    <span className="font-semibold text-gray-900">{directGroups}</span>
                    <span className="text-gray-600"> Direct</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">{ruleBasedGroups}</span>
                    <span className="text-gray-600"> Rule-Based</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Groups */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Groups</h3>
              <button
                onClick={() => onTabChange('users')}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                View All →
              </button>
            </div>
            <div className="space-y-2">
              {groups.slice(0, 5).map((membership, index) => (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">
                      {membership.group.profile.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {membership.membershipType === 'DIRECT' ? 'Direct Assignment' : 'Rule-Based'}
                    </div>
                  </div>
                  <span className={`
                    px-2 py-1 rounded text-xs font-medium
                    ${membership.membershipType === 'DIRECT' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}
                  `}>
                    {membership.membershipType === 'DIRECT' ? 'Manual' : 'Auto'}
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
