import React from 'react';
import type { GroupMembership } from '../../../shared/types';

interface GroupMembershipsListProps {
  memberships: GroupMembership[];
  isLoading: boolean;
  currentGroupId?: string;
  oktaOrigin?: string;
  onNavigateToRule?: (ruleId: string) => void;
}

const getMembershipTypeBadge = (type: string) => {
  switch (type) {
    case 'RULE_BASED':
      return 'badge badge-info';
    case 'DIRECT':
      return 'badge badge-success';
    default:
      return 'badge badge-muted';
  }
};

/**
 * Displays a list of group memberships for a user.
 */
const GroupMembershipsList: React.FC<GroupMembershipsListProps> = ({
  memberships,
  isLoading,
  currentGroupId,
  oktaOrigin,
  onNavigateToRule,
}) => {
  const highlightCurrentGroup = (groupId: string) => {
    return currentGroupId && groupId === currentGroupId;
  };

  return (
    <div className="rounded-md border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 bg-neutral-50 border-b border-neutral-200/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">
            Group Memberships ({memberships.length})
          </h3>
          <span
            className="text-amber-600 cursor-help"
            title="Direct vs Rule-Based detection uses heuristics. Okta API doesn't expose this data directly. See console for detection details."
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-neutral-200 border-t-primary rounded-full animate-spin" />
          </div>
          <p className="mt-4 text-neutral-600 text-sm">Loading group memberships...</p>
        </div>
      ) : memberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-neutral-500 text-sm">This user is not a member of any groups</p>
        </div>
      ) : (
        <div className="p-4 space-y-3 bg-white">
          {memberships.map((membership) => (
            <div
              key={membership.group.id}
              className={`
                rounded-md border p-4 transition-all duration-100
                ${highlightCurrentGroup(membership.group.id)
                  ? 'border-primary bg-primary-light ring-1 ring-primary/20'
                  : 'border-neutral-200 bg-white hover:border-neutral-500'
                }
              `}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h4 className="font-semibold text-neutral-900 text-sm">
                      {membership.group.profile.name}
                    </h4>
                    {highlightCurrentGroup(membership.group.id) && (
                      <span className="px-2 py-0.5 rounded-md bg-primary text-white text-xs font-bold">
                        Current Group
                      </span>
                    )}
                    {oktaOrigin && (
                      <button
                        onClick={() => window.open(`${oktaOrigin}/admin/group/${membership.group.id}`, '_blank')}
                        className="p-1.5 text-neutral-400 hover:text-primary-text hover:bg-primary-light rounded transition-all duration-100"
                        title="Open group in Okta admin"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {membership.group.profile.description && (
                    <p className="text-xs text-neutral-600">
                      {membership.group.profile.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className={getMembershipTypeBadge(membership.membershipType)}>
                    {membership.membershipType.replace('_', ' ')}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-xs font-medium border border-neutral-200">
                    {membership.group.type}
                  </span>
                </div>
              </div>

              {/* Show rule details if rule-based */}
              {membership.membershipType === 'RULE_BASED' && membership.rule && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-sm font-semibold text-blue-900">Likely Added by Rule:</span>
                    <span className="text-sm text-blue-800">{membership.rule.name}</span>
                    <span
                      className="text-amber-500 cursor-help"
                      title="Approximate match based on rule evaluation. Okta API doesn't expose which rule actually added the user."
                    >*</span>
                    {onNavigateToRule && (
                      <button
                        className="ml-auto px-3 py-1.5 text-xs font-medium bg-white text-neutral-700 border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors shadow-sm inline-flex items-center gap-1"
                        onClick={() => onNavigateToRule(membership.rule!.id)}
                        title="View this rule in Rules tab"
                      >
                        <span>View Rule</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {membership.rule.conditions?.expression?.value && (
                    <div className="mt-2">
                      <span className="text-xs font-semibold text-blue-800 block mb-1">Condition:</span>
                      <code className="block text-xs font-mono text-blue-900 bg-white p-2 rounded border border-blue-200 overflow-x-auto">
                        {membership.rule.conditions.expression.value}
                      </code>
                    </div>
                  )}
                </div>
              )}

              {membership.membershipType === 'DIRECT' && (
                <div className="mt-3 p-3 bg-neutral-50 rounded-md border border-neutral-200">
                  <p className="text-xs text-neutral-600 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    This user was added directly to the group (not through a rule)
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupMembershipsList;
