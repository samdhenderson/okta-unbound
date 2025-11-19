import React, { useState, useMemo } from 'react';
import type { OrphanedAccount } from '../../../shared/types';
import { exportOrphanedAccountsToCSV } from '../../../shared/utils/securityExport';

interface OrphanedAccountsListProps {
  accounts: OrphanedAccount[];
  groupName: string;
  onRemoveSelected?: (userIds: string[]) => void;
  isRemoving?: boolean;
}

const OrphanedAccountsList: React.FC<OrphanedAccountsListProps> = ({
  accounts,
  groupName,
  onRemoveSelected,
  isRemoving = false,
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

  const getRiskColor = (riskLevel: OrphanedAccount['riskLevel']): string => {
    const colors: Record<OrphanedAccount['riskLevel'], string> = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#6c757d',
    };
    return colors[riskLevel];
  };

  if (accounts.length === 0) {
    return (
      <div className="empty-state">
        <p>No orphaned accounts detected. Great job!</p>
      </div>
    );
  }

  return (
    <div className="orphaned-accounts-list">
      {/* Toolbar */}
      <div className="list-toolbar">
        <div className="toolbar-left">
          <select
            className="filter-select"
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value as OrphanedAccount['orphanReason'] | '')}
          >
            <option value="">All Reasons</option>
            <option value="deprovisioned_in_groups">Deprovisioned</option>
            <option value="never_logged_in">Never Logged In</option>
            <option value="inactive_180d">Inactive 180+ Days</option>
            <option value="inactive_90d">Inactive 90-179 Days</option>
          </select>
          <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'email' | 'daysSinceLogin' | 'riskLevel')}>
            <option value="riskLevel">Sort by Risk</option>
            <option value="email">Sort by Email</option>
            <option value="daysSinceLogin">Sort by Inactivity</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-sm btn-secondary" onClick={handleExport}>
            Export to CSV
          </button>
          {onRemoveSelected && (
            <button
              className="btn btn-sm btn-danger"
              onClick={handleRemoveSelected}
              disabled={selectedUsers.size === 0 || isRemoving}
            >
              {isRemoving ? 'Removing...' : `Remove Selected (${selectedUsers.size})`}
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="accounts-summary">
        <span>
          Showing {filteredAndSortedAccounts.length} of {accounts.length} orphaned accounts
        </span>
        {selectedUsers.size > 0 && <span className="selected-count">{selectedUsers.size} selected</span>}
      </div>

      {/* Grouped List */}
      <div className="risk-groups">
        {(['critical', 'high', 'medium', 'low'] as const).map((riskLevel) => {
          const accountsInGroup = groupedByRisk[riskLevel];
          if (accountsInGroup.length === 0) return null;

          const isExpanded = expandedRiskLevel.has(riskLevel);

          return (
            <div key={riskLevel} className="risk-group">
              <div
                className="risk-group-header"
                onClick={() => toggleRiskLevel(riskLevel)}
                style={{ cursor: 'pointer', borderLeftColor: getRiskColor(riskLevel) }}
              >
                <div className="risk-group-title">
                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                  <span className="risk-label" style={{ color: getRiskColor(riskLevel) }}>
                    {riskLevel.toUpperCase()}
                  </span>
                  <span className="risk-count">({accountsInGroup.length})</span>
                </div>
                <div className="risk-group-actions">
                  {onRemoveSelected && (
                    <button
                      className="btn btn-xs"
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
              </div>

              {isExpanded && (
                <div className="risk-group-body">
                  <table className="accounts-table">
                    <thead>
                      <tr>
                        {onRemoveSelected && (
                          <th style={{ width: '30px' }}>
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
                            />
                          </th>
                        )}
                        <th>Email</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        <th>Days Inactive</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountsInGroup.map((account) => (
                        <tr key={account.userId}>
                          {onRemoveSelected && (
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedUsers.has(account.userId)}
                                onChange={() => toggleUserSelection(account.userId)}
                              />
                            </td>
                          )}
                          <td>{account.email}</td>
                          <td>
                            {account.firstName} {account.lastName}
                          </td>
                          <td>
                            <span className={`status-badge status-${account.status.toLowerCase()}`}>
                              {account.status}
                            </span>
                          </td>
                          <td>{account.lastLogin ? account.lastLogin.toLocaleDateString() : 'Never'}</td>
                          <td>{account.daysSinceLogin ?? 'N/A'}</td>
                          <td>{getReasonLabel(account.orphanReason)}</td>
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
