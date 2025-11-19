import React, { useState, useMemo } from 'react';
import type { StaleGroupMembership } from '../../../shared/types';
import { exportStaleMembershipsToCSV } from '../../../shared/utils/securityExport';

interface StaleMembershipsListProps {
  memberships: StaleGroupMembership[];
  groupName: string;
}

const StaleMembershipsList: React.FC<StaleMembershipsListProps> = ({ memberships, groupName }) => {
  const [sortBy, setSortBy] = useState<'email' | 'daysInGroup' | 'source'>('daysInGroup');

  // Filter and sort memberships
  const sortedMemberships = useMemo(() => {
    const sorted = [...memberships].sort((a, b) => {
      if (sortBy === 'email') {
        return a.email.localeCompare(b.email);
      } else if (sortBy === 'daysInGroup') {
        const aDays = a.daysInGroup ?? 0;
        const bDays = b.daysInGroup ?? 0;
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
      <div className="empty-state">
        <p>No stale memberships detected. All memberships appear current!</p>
      </div>
    );
  }

  return (
    <div className="stale-memberships-list">
      {/* Toolbar */}
      <div className="list-toolbar">
        <div className="toolbar-left">
          <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'email' | 'daysInGroup' | 'source')}>
            <option value="daysInGroup">Sort by Days in Group</option>
            <option value="email">Sort by Email</option>
            <option value="source">Sort by Source</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-sm btn-secondary" onClick={handleExport}>
            Export to CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="memberships-summary">
        <span>
          {sortedMemberships.length} membership{sortedMemberships.length !== 1 ? 's' : ''} requiring review
        </span>
      </div>

      {/* Info Box */}
      <div className="info-box" style={{ marginBottom: '16px', padding: '12px', background: '#e7f3ff', borderLeft: '4px solid #0066cc' }}>
        <strong>What are stale memberships?</strong>
        <p style={{ marginTop: '8px', marginBottom: '0' }}>
          Memberships older than 90 days should be periodically reviewed to ensure users still need access. This is
          especially important for direct assignments that may have been temporary.
        </p>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="memberships-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Added Date</th>
              <th>Days in Group</th>
              <th>Source</th>
              <th>Matches Rules</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {sortedMemberships.map((membership) => (
              <tr key={membership.userId} className={membership.shouldReview ? 'review-required' : ''}>
                <td>{membership.email}</td>
                <td>
                  {membership.firstName} {membership.lastName}
                </td>
                <td>{membership.addedDate ? membership.addedDate.toLocaleDateString() : 'Unknown'}</td>
                <td>
                  <strong>{membership.daysInGroup ?? 'N/A'}</strong>
                </td>
                <td>
                  <span className={`source-badge source-${membership.source}`}>
                    {membership.source === 'direct' ? 'Direct' : 'Rule-Based'}
                  </span>
                </td>
                <td>
                  {membership.source === 'rule-based' ? (
                    membership.matchesRules ? (
                      <span className="matches-yes">✓ Yes</span>
                    ) : (
                      <span className="matches-no">✗ No</span>
                    )
                  ) : (
                    <span style={{ color: '#999' }}>N/A</span>
                  )}
                </td>
                <td>
                  {membership.shouldReview ? (
                    <span className="recommendation-review">Review Required</span>
                  ) : (
                    <span className="recommendation-ok">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="list-legend" style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
        <div>
          <strong>Direct:</strong> User was manually added to the group
        </div>
        <div>
          <strong>Rule-Based:</strong> User was added via a group rule
        </div>
        <div style={{ marginTop: '8px' }}>
          <strong>Note:</strong> Direct memberships older than 90 days should be reviewed to ensure they are still
          needed. Consider converting long-standing patterns into group rules.
        </div>
      </div>
    </div>
  );
};

export default StaleMembershipsList;
