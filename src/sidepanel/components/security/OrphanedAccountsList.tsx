import React, { useState, useMemo } from 'react';
import type { OrphanedAccount } from '../../../shared/types';
import { exportOrphanedAccountsToCSV } from '../../../shared/utils/securityExport';

interface OrphanedAccountsListProps {
  accounts: OrphanedAccount[];
  groupName: string;
  onRemoveSelected?: (userIds: string[]) => void;
  isRemoving?: boolean;
  showMetadata?: boolean; // Whether to show app assignments and group memberships columns
}

const OrphanedAccountsList: React.FC<OrphanedAccountsListProps> = ({
  accounts,
  groupName,
  onRemoveSelected,
  isRemoving = false,
  showMetadata = false,
}) => {
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [filterReason, setFilterReason] = useState<OrphanedAccount['orphanReason'] | ''>('');
  const [sortBy, setSortBy] = useState<'email' | 'daysSinceLogin' | 'riskLevel'>('riskLevel');
  const [expandedRiskLevel, setExpandedRiskLevel] = useState<Set<string>>(
    new Set(['critical', 'high', 'medium', 'low'])
  );

  // Filter and sort accounts
  const filteredAndSortedAccounts = useMemo(() => {
    let filtered = accounts;

    // Apply reason filter
    if (filterReason) {
      filtered = filtered.filter((a) => a.orphanReason === filterReason);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'email') {
        return a.email.localeCompare(b.email);
      } else if (sortBy === 'daysSinceLogin') {
        const aDays = a.daysSinceLogin ?? 999999;
        const bDays = b.daysSinceLogin ?? 999999;
        return bDays - aDays;
      } else if (sortBy === 'riskLevel') {
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      }
      return 0;
    });

    return sorted;
  }, [accounts, filterReason, sortBy]);

  // Group by risk level
  const groupedByRisk = useMemo(() => {
    const groups: Record<string, OrphanedAccount[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    filteredAndSortedAccounts.forEach((account) => {
      groups[account.riskLevel].push(account);
    });

    return groups;
  }, [filteredAndSortedAccounts]);

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleRiskLevel = (riskLevel: string) => {
    const newExpanded = new Set(expandedRiskLevel);
    if (newExpanded.has(riskLevel)) {
      newExpanded.delete(riskLevel);
    } else {
      newExpanded.add(riskLevel);
    }
    setExpandedRiskLevel(newExpanded);
  };

  const handleRemoveSelected = () => {
    if (onRemoveSelected && selectedUsers.size > 0) {
      onRemoveSelected(Array.from(selectedUsers));
    }
  };

  const handleExport = () => {
    exportOrphanedAccountsToCSV(filteredAndSortedAccounts, groupName);
  };

  const getReasonLabel = (reason: OrphanedAccount['orphanReason']): string => {
    const labels: Record<OrphanedAccount['orphanReason'], string> = {
      never_logged_in: 'Never Logged In',
      inactive_90d: 'Inactive 90-179 Days',
      inactive_180d: 'Inactive 180+ Days',
      no_apps: 'No App Assignments',
      deprovisioned_in_groups: 'Deprovisioned',
    };
    return labels[reason];
  };

  // Reserved for future use when risk level coloring is implemented
  const _getRiskColor = (riskLevel: OrphanedAccount['riskLevel']): string => {
    const colors: Record<OrphanedAccount['riskLevel'], string> = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#6c757d',
    };
    return colors[riskLevel];
  };
  void _getRiskColor; // Suppress unused warning

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 bg-gradient-to-br from-emerald-50 to-white rounded-lg border border-emerald-200">
        <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-900">No orphaned accounts detected</p>
        <p className="text-sm text-gray-600 mt-1">Great job keeping your group clean!</p>
      </div>
    );
  }

  const getRiskLevelConfig = (riskLevel: OrphanedAccount['riskLevel']) => {
    const configs = {
      critical: {
        color: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        dotColor: 'bg-red-500',
        ringColor: 'ring-red-500/20',
      },
      high: {
        color: 'text-orange-700',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        dotColor: 'bg-orange-500',
        ringColor: 'ring-orange-500/20',
      },
      medium: {
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        dotColor: 'bg-amber-500',
        ringColor: 'ring-amber-500/20',
      },
      low: {
        color: 'text-gray-700',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        dotColor: 'bg-gray-500',
        ringColor: 'ring-gray-500/20',
      },
    };
    return configs[riskLevel];
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value as OrphanedAccount['orphanReason'] | '')}
          >
            <option value="">All Reasons</option>
            <option value="deprovisioned_in_groups">Deprovisioned</option>
            <option value="never_logged_in">Never Logged In</option>
            <option value="inactive_180d">Inactive 180+ Days</option>
            <option value="inactive_90d">Inactive 90-179 Days</option>
          </select>
          <select
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'email' | 'daysSinceLogin' | 'riskLevel')}
          >
            <option value="riskLevel">Sort by Risk</option>
            <option value="email">Sort by Email</option>
            <option value="daysSinceLogin">Sort by Inactivity</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow inline-flex items-center gap-2"
            onClick={handleExport}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          {onRemoveSelected && (
            <button
              className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:from-red-300 disabled:to-red-400 disabled:cursor-not-allowed inline-flex items-center gap-2"
              onClick={handleRemoveSelected}
              disabled={selectedUsers.size === 0 || isRemoving}
            >
              {isRemoving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Removing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove Selected ({selectedUsers.size})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-blue-50/50 rounded-lg border border-blue-200/50">
        <span className="text-sm text-gray-700">
          Showing <span className="font-semibold text-gray-900">{filteredAndSortedAccounts.length}</span> of{' '}
          <span className="font-semibold text-gray-900">{accounts.length}</span> orphaned accounts
        </span>
        {selectedUsers.size > 0 && (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-md border border-blue-200">
            {selectedUsers.size} selected
          </span>
        )}
      </div>

      {/* Grouped List */}
      <div className="space-y-4">
        {(['critical', 'high', 'medium', 'low'] as const).map((riskLevel) => {
          const accountsInGroup = groupedByRisk[riskLevel];
          if (accountsInGroup.length === 0) return null;

          const isExpanded = expandedRiskLevel.has(riskLevel);
          const config = getRiskLevelConfig(riskLevel);

          return (
            <div
              key={riskLevel}
              className={`bg-white rounded-lg border ${config.borderColor} shadow-sm transition-all duration-300 overflow-hidden hover:shadow-md`}
            >
              {/* Risk Group Header */}
              <div
                className={`p-4 cursor-pointer ${config.bgColor} hover:opacity-80 transition-all duration-200 flex items-center justify-between gap-4 border-b ${config.borderColor}`}
                onClick={() => toggleRiskLevel(riskLevel)}
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className={`w-2.5 h-2.5 rounded-full ${config.dotColor} ring-4 ${config.ringColor}`} />
                  <span className={`text-sm font-bold uppercase tracking-wide ${config.color}`}>
                    {riskLevel}
                  </span>
                  <span className="px-2 py-0.5 bg-white rounded-full text-xs font-semibold text-gray-600 shadow-sm">
                    {accountsInGroup.length}
                  </span>
                </div>
                {onRemoveSelected && (
                  <button
                    className="px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-all duration-200 shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const groupUserIds = accountsInGroup.map((a) => a.userId);
                      setSelectedUsers(new Set(groupUserIds));
                    }}
                  >
                    Select All
                  </button>
                )}
              </div>

              {/* Risk Group Body */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {onRemoveSelected && (
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-10">
                            <input
                              type="checkbox"
                              checked={accountsInGroup.every((a) => selectedUsers.has(a.userId))}
                              onChange={() => {
                                const groupUserIds = new Set(accountsInGroup.map((a) => a.userId));
                                const allSelected = accountsInGroup.every((a) => selectedUsers.has(a.userId));
                                const newSelected = new Set(selectedUsers);

                                if (allSelected) {
                                  groupUserIds.forEach((id) => newSelected.delete(id));
                                } else {
                                  groupUserIds.forEach((id) => newSelected.add(id));
                                }

                                setSelectedUsers(newSelected);
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-[#007dc1] focus:ring-[#007dc1]/30 transition-all duration-200"
                            />
                          </th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Login</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Days Inactive</th>
                        {showMetadata && (
                          <>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Apps</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Groups</th>
                          </>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {accountsInGroup.map((account) => (
                        <tr key={account.userId} className="hover:bg-gray-50/50 transition-colors duration-150">
                          {onRemoveSelected && (
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedUsers.has(account.userId)}
                                onChange={() => toggleUserSelection(account.userId)}
                                className="w-4 h-4 rounded border-gray-300 text-[#007dc1] focus:ring-[#007dc1]/30 transition-all duration-200"
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{account.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {account.firstName} {account.lastName}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-md text-xs font-semibold ${
                                account.status.toLowerCase() === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : account.status.toLowerCase() === 'deprovisioned'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-gray-50 text-gray-700 border border-gray-200'
                              }`}
                            >
                              {account.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {account.lastLogin ? account.lastLogin.toLocaleDateString() : (
                              <span className="text-gray-400 italic">Never</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600">
                            {account.daysSinceLogin ?? <span className="text-gray-400">N/A</span>}
                          </td>
                          {showMetadata && (
                            <>
                              <td className="px-4 py-3 text-sm text-center font-mono text-gray-700">
                                {account.appAssignments > 0 ? (
                                  <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-md font-semibold">
                                    {account.appAssignments}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">0</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-center font-mono text-gray-700">
                                {account.groupMemberships > 0 ? (
                                  <span className="px-2 py-1 bg-cyan-50 text-cyan-700 rounded-md font-semibold">
                                    {account.groupMemberships}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">0</span>
                                )}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md border border-blue-200 whitespace-nowrap">
                              {getReasonLabel(account.orphanReason)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrphanedAccountsList;
