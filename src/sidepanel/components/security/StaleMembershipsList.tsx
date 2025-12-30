import React, { useState, useMemo } from 'react';
import type { StaleGroupMembership } from '../../../shared/types';
import { exportStaleMembershipsToCSV } from '../../../shared/utils/securityExport';

interface StaleMembershipsListProps {
  memberships: StaleGroupMembership[];
  groupName: string;
}

const StaleMembershipsList: React.FC<StaleMembershipsListProps> = ({ memberships, groupName }) => {
  const [sortBy, setSortBy] = useState<'email' | 'daysSinceCreated' | 'source'>('daysSinceCreated');

  // Filter and sort memberships
  const sortedMemberships = useMemo(() => {
    const sorted = [...memberships].sort((a, b) => {
      if (sortBy === 'email') {
        return a.email.localeCompare(b.email);
      } else if (sortBy === 'daysSinceCreated') {
        const aDays = a.daysSinceCreated ?? 0;
        const bDays = b.daysSinceCreated ?? 0;
        return bDays - aDays; // Descending order
      } else if (sortBy === 'source') {
        return a.source.localeCompare(b.source);
      }
      return 0;
    });

    return sorted;
  }, [memberships, sortBy]);

  const handleExport = () => {
    exportStaleMembershipsToCSV(sortedMemberships, groupName);
  };

  if (memberships.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 bg-gradient-to-br from-emerald-50 to-white rounded-lg border border-emerald-200">
        <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-900">No stale memberships detected</p>
        <p className="text-sm text-gray-600 mt-1">All memberships appear current!</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <select
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'email' | 'daysSinceCreated' | 'source')}
          >
            <option value="daysSinceCreated">Sort by Account Age</option>
            <option value="email">Sort by Email</option>
            <option value="source">Sort by Source</option>
          </select>
        </div>
        <button
          className="px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow inline-flex items-center gap-2"
          onClick={handleExport}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50/50 rounded-lg border border-blue-200/50">
        <span className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">{sortedMemberships.length}</span> membership{sortedMemberships.length !== 1 ? 's' : ''} requiring review
        </span>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-50/30 rounded-lg border-l-4 border-[#007dc1]">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 mt-0.5 rounded-full bg-[#007dc1] flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">What are stale memberships?</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              Memberships older than 90 days should be periodically reviewed to ensure users still need access. This is
              especially important for direct assignments that may have been temporary.
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" title="User's Okta account creation date (group membership date not available from Okta API)">
                  Account Created
                  <span className="ml-1 text-amber-500 cursor-help" title="Note: Okta API does not provide group membership dates">*</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" title="Days since user was created in Okta">Account Age</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" title="Heuristic approximation - may not be 100% accurate">
                  Source
                  <span className="ml-1 text-amber-500 cursor-help" title="Approximate - based on rule evaluation heuristics">*</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Matches Rules</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedMemberships.map((membership) => (
                <tr
                  key={membership.userId}
                  className={`transition-colors duration-150 ${
                    membership.shouldReview ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'hover:bg-gray-50/50'
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{membership.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {membership.firstName} {membership.lastName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {membership.userCreatedDate ? (
                      typeof membership.userCreatedDate === 'string'
                        ? new Date(membership.userCreatedDate).toLocaleDateString()
                        : membership.userCreatedDate.toLocaleDateString()
                    ) : (
                      <span className="text-gray-400 italic">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {membership.daysSinceCreated != null ? `${membership.daysSinceCreated} days` : <span className="text-gray-400 font-normal">N/A</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-md text-xs font-semibold ${
                        membership.source === 'direct'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {membership.source === 'direct' ? 'Direct' : 'Rule-Based'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {membership.source === 'rule-based' ? (
                      membership.matchesRules ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          No
                        </span>
                      )
                    ) : (
                      <span className="text-gray-400 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {membership.shouldReview ? (
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-md border border-amber-200">
                        Review Required
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md border border-emerald-200">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2 text-sm text-gray-700">
        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-900 min-w-[100px]">Direct:</span>
          <span>User was manually added to the group</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-900 min-w-[100px]">Rule-Based:</span>
          <span>User was added via a group rule</span>
        </div>
        <div className="pt-2 mt-2 border-t border-gray-200 flex items-start gap-2">
          <span className="font-semibold text-gray-900 min-w-[100px]">Note:</span>
          <span>Direct memberships older than 90 days should be reviewed to ensure they are still needed. Consider converting long-standing patterns into group rules.</span>
        </div>
        <div className="pt-2 mt-2 border-t border-gray-200 flex items-start gap-2">
          <span className="font-semibold text-amber-600 min-w-[100px]">* API Limit:</span>
          <span className="text-gray-600">
            Okta API does not expose group membership dates or direct/rule-based attribution.
            "Account Created" shows when the user was created in Okta (not when added to this group).
            "Source" is a heuristic approximation based on rule evaluation.
          </span>
        </div>
      </div>
    </div>
  );
};

export default StaleMembershipsList;
