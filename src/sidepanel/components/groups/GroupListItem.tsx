import React, { useState } from 'react';
import type { GroupSummary } from '../../../shared/types';

interface GroupListItemProps {
  group: GroupSummary;
  selected: boolean;
  onToggleSelect: (groupId: string) => void;
  onOpenInOkta?: (groupId: string) => void;
  oktaOrigin?: string;
}

const GroupListItem: React.FC<GroupListItemProps> = ({
  group,
  selected,
  onToggleSelect,
  onOpenInOkta,
  oktaOrigin,
}) => {
  const [expanded, setExpanded] = useState(false);

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'OKTA_GROUP':
        return 'badge-primary';
      case 'APP_GROUP':
        return 'badge-warning';
      case 'BUILT_IN':
        return 'badge-info';
      default:
        return 'badge-secondary';
    }
  };

  const getHealthScoreClass = (score?: number) => {
    if (!score) return '';
    if (score >= 80) return 'health-good';
    if (score >= 60) return 'health-fair';
    return 'health-poor';
  };

  const handleOpenInOkta = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (oktaOrigin) {
      window.open(`${oktaOrigin}/admin/group/${group.id}`, '_blank');
    }
  };

  return (
    <div className={`group-list-item ${selected ? 'selected' : ''}`}>
      <div className="group-list-item-header" onClick={() => setExpanded(!expanded)}>
        <div className="group-list-item-checkbox">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(group.id)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="group-list-item-content">
          <div className="group-list-item-title">
            <span className="group-name">{group.name}</span>
            <span className={`badge ${getTypeBadgeClass(group.type)}`}>
              {group.type.replace('_', ' ')}
            </span>
          </div>
          <div className="group-list-item-meta">
            <span className="member-count">{group.memberCount} members</span>
            {group.hasRules && (
              <span className="rule-count">{group.ruleCount} rule{group.ruleCount !== 1 ? 's' : ''}</span>
            )}
            {group.healthScore !== undefined && (
              <span className={`health-score ${getHealthScoreClass(group.healthScore)}`}>
                Health: {group.healthScore}%
              </span>
            )}
          </div>
        </div>
        <div className="group-list-item-actions">
          {oktaOrigin && (
            <button
              className="btn-icon"
              onClick={handleOpenInOkta}
              title="Open in Okta"
            >
              ↗
            </button>
          )}
          <button
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="group-list-item-details">
          {group.description && (
            <div className="detail-row">
              <strong>Description:</strong> {group.description}
            </div>
          )}
          <div className="detail-row">
            <strong>ID:</strong> <code>{group.id}</code>
          </div>
          {group.lastUpdated && (
            <div className="detail-row">
              <strong>Last Updated:</strong> {new Date(group.lastUpdated).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupListItem;
