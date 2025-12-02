import React, { useState, useCallback, memo } from 'react';
import type { GroupSummary } from '../../../shared/types';
import { formatRelativeTime } from '../../../shared/utils/stalenessCalculator';

interface GroupListItemProps {
  group: GroupSummary;
  selected: boolean;
  onToggleSelect: (groupId: string) => void;
  onOpenInOkta?: (groupId: string) => void;
  oktaOrigin?: string;
}

/**
 * Memoized list item component for displaying group information.
 * Uses React.memo with custom comparison to prevent unnecessary re-renders
 * when parent list updates but this item's data hasn't changed.
 */
const GroupListItem: React.FC<GroupListItemProps> = memo(({
  group,
  selected,
  onToggleSelect,
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

  const handleOpenInOkta = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (oktaOrigin) {
      window.open(`${oktaOrigin}/admin/group/${group.id}`, '_blank');
    }
  }, [oktaOrigin, group.id]);

  const handleToggle = useCallback(() => {
    onToggleSelect(group.id);
  }, [onToggleSelect, group.id]);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  return (
    <div className={`group-list-item ${selected ? 'selected' : ''} ${group.isPushGroup ? 'push-group' : ''}`}>
      <div className="group-list-item-header" onClick={toggleExpanded}>
        <div className="group-list-item-checkbox">
          <input
            type="checkbox"
            checked={selected}
            onChange={handleToggle}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="group-list-item-content">
          <div className="group-list-item-title">
            <span className="group-name">{group.name}</span>
            <div className="group-badges">
              <span className={`badge ${getTypeBadgeClass(group.type)}`}>
                {group.type === 'OKTA_GROUP' ? 'OKTA' : group.type === 'APP_GROUP' ? 'APP' : group.type.replace('_', ' ')}
              </span>
              {group.isPushGroup && group.linkedGroups && group.linkedGroups.length > 0 && (
                <>
                  {group.linkedGroups.map((lg) => (
                    <span key={lg.id} className="badge badge-warning" title={`Linked to ${lg.sourceAppName || 'App'}`}>
                      APP{lg.sourceAppName ? `: ${lg.sourceAppName}` : ''}
                    </span>
                  ))}
                </>
              )}
              {group.type === 'APP_GROUP' && group.sourceAppName && (
                <span className="badge badge-secondary" title="Source application">
                  {group.sourceAppName}
                </span>
              )}
              {group.isStale && (
                <span
                  className="badge badge-warning"
                  title={`Stale: ${group.stalenessReasons?.join(', ')}`}
                >
                  STALE
                </span>
              )}
            </div>
          </div>
          <div className="group-list-item-meta">
            <span className="member-count">
              {group.isPushGroup && group.linkedGroups && group.linkedGroups.length > 0
                ? `${group.memberCount} + ${group.linkedGroups.reduce((sum, lg) => sum + lg.memberCount, 0)} members`
                : `${group.memberCount} members`
              }
            </span>
            {group.hasRules && (
              <span className="rule-count">{group.ruleCount} rule{group.ruleCount !== 1 ? 's' : ''}</span>
            )}
            {group.healthScore !== undefined && (
              <span className={`health-score ${getHealthScoreClass(group.healthScore)}`}>
                Health: {group.healthScore}%
              </span>
            )}
            {group.lastMembershipUpdated && (
              <span className="last-activity" title="Last membership change">
                Last active: {formatRelativeTime(group.lastMembershipUpdated)}
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
              toggleExpanded();
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
          {group.created && (
            <div className="detail-row">
              <strong>Created:</strong> {new Date(group.created).toLocaleString()}
            </div>
          )}
          {group.lastMembershipUpdated && (
            <div className="detail-row">
              <strong>Last Membership Change:</strong> {new Date(group.lastMembershipUpdated).toLocaleString()}
            </div>
          )}
          {group.stalenessScore !== undefined && (
            <div className="detail-row">
              <strong>Staleness Score:</strong> {group.stalenessScore}/100
              {group.stalenessReasons && group.stalenessReasons.length > 0 && (
                <ul style={{ marginTop: '4px', marginLeft: '20px' }}>
                  {group.stalenessReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {group.type === 'APP_GROUP' && group.sourceAppName && (
            <div className="detail-row">
              <strong>Source App:</strong> {group.sourceAppName}
            </div>
          )}
          {group.isPushGroup && group.linkedGroups && group.linkedGroups.length > 0 && (
            <div className="detail-row linked-groups-section">
              <strong>Linked App Groups:</strong>
              <ul className="linked-groups-list">
                {group.linkedGroups.map(lg => (
                  <li key={lg.id}>
                    <span className="linked-group-name">{lg.name}</span>
                    {lg.sourceAppName && (
                      <span className="linked-group-app"> ({lg.sourceAppName})</span>
                    )}
                    <span className="linked-group-members"> - {lg.memberCount} members</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these specific props change
  return (
    prevProps.group.id === nextProps.group.id &&
    prevProps.group.name === nextProps.group.name &&
    prevProps.group.memberCount === nextProps.group.memberCount &&
    prevProps.group.type === nextProps.group.type &&
    prevProps.group.isPushGroup === nextProps.group.isPushGroup &&
    prevProps.group.hasRules === nextProps.group.hasRules &&
    prevProps.group.ruleCount === nextProps.group.ruleCount &&
    prevProps.group.isStale === nextProps.group.isStale &&
    prevProps.group.stalenessScore === nextProps.group.stalenessScore &&
    prevProps.selected === nextProps.selected &&
    prevProps.oktaOrigin === nextProps.oktaOrigin
  );
});

GroupListItem.displayName = 'GroupListItem';

export default GroupListItem;
