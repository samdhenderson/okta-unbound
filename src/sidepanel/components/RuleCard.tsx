import React, { useState, useCallback, memo } from 'react';
import type { FormattedRule } from '../../shared/types';
import { timeAgo } from '../../shared/ruleUtils';

interface RuleCardProps {
  rule: FormattedRule;
  onActivate?: (ruleId: string) => void;
  onDeactivate?: (ruleId: string) => void;
  oktaOrigin?: string | null;
  isHighlighted?: boolean;
}

/**
 * Memoized card component for displaying rule information.
 * Uses React.memo to prevent unnecessary re-renders when list updates.
 */

// Helper function to render condition expression with group name badges
const renderConditionWithGroupBadges = (
  expression: string,
  allGroupNamesMap?: Record<string, string>
): React.ReactNode => {
  // If no group names map is provided, return expression as-is
  if (!allGroupNamesMap || Object.keys(allGroupNamesMap).length === 0) {
    return expression;
  }

  // Find all group IDs in the expression (Okta group IDs are 20 characters alphanumeric)
  const groupIdPattern = /\b00g[a-zA-Z0-9]{17}\b/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = groupIdPattern.exec(expression)) !== null) {
    const groupId = match[0];
    const groupName = allGroupNamesMap[groupId];

    // Add text before the group ID
    if (match.index > lastIndex) {
      parts.push(expression.substring(lastIndex, match.index));
    }

    // Add the group ID with badge if name exists
    if (groupName && groupName !== groupId) {
      parts.push(
        <React.Fragment key={`${groupId}-${match.index}`}>
          <span className="group-id-in-condition">{groupId}</span>
          <span className="group-badge-inline" title={`Group: ${groupName}`}>
            {groupName}
          </span>
        </React.Fragment>
      );
    } else {
      parts.push(groupId);
    }

    lastIndex = match.index + groupId.length;
  }

  // Add remaining text
  if (lastIndex < expression.length) {
    parts.push(expression.substring(lastIndex));
  }

  return parts.length > 0 ? parts : expression;
};

const RuleCard: React.FC<RuleCardProps> = memo(({
  rule,
  onActivate,
  onDeactivate,
  oktaOrigin,
  isHighlighted = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand if highlighted
  React.useEffect(() => {
    if (isHighlighted) {
      setIsExpanded(true);
    }
  }, [isHighlighted]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleActivate = useCallback(() => {
    onActivate?.(rule.id);
  }, [onActivate, rule.id]);

  const handleDeactivate = useCallback(() => {
    onDeactivate?.(rule.id);
  }, [onDeactivate, rule.id]);

  const statusColor = rule.status === 'ACTIVE' ? 'success' : 'inactive';
  const hasConflicts = rule.conflicts && rule.conflicts.length > 0;

  return (
    <div className={`rule-card ${rule.affectsCurrentGroup ? 'affects-current' : ''} ${isHighlighted ? 'highlighted-rule' : ''}`}>
      {/* Header */}
      <div className="rule-header" onClick={toggleExpanded}>
        <div className="rule-header-left">
          <span className={`rule-status-dot ${statusColor}`}></span>
          <div>
            <div className="rule-name-row">
              <span className="rule-name">{rule.name}</span>
              {rule.affectsCurrentGroup && (
                <span className="badge badge-primary">Current Group</span>
              )}
              {hasConflicts && (
                <span className="badge badge-warning">
                  ⚠️ {rule.conflicts!.length} Conflict{rule.conflicts!.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="rule-summary">
              <span className="rule-condition-preview">{rule.condition}</span>
            </div>
          </div>
        </div>
        <button className="expand-button" type="button">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="rule-body">
          {/* Condition */}
          <div className="rule-section">
            <div className="rule-section-label">WHEN</div>
            <div className="rule-condition">
              <code>
                {renderConditionWithGroupBadges(
                  rule.conditionExpression || rule.condition,
                  rule.allGroupNamesMap
                )}
              </code>
            </div>
          </div>

          {/* User Attributes */}
          {rule.userAttributes.length > 0 && (
            <div className="rule-section">
              <div className="rule-section-label">USES ATTRIBUTES</div>
              <div className="rule-tags">
                {rule.userAttributes.map((attr) => (
                  <span key={attr} className="tag tag-info">
                    {attr}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {rule.groupIds.length > 0 && (
            <div className="rule-section">
              <div className="rule-section-label">THEN ADD TO GROUPS</div>
              <div className="rule-tags">
                {rule.groupIds.map((groupId, index) => {
                  const groupName = rule.groupNames?.[index];
                  const isNameDifferent = groupName && groupName !== groupId;

                  return (
                    <div key={groupId} className="group-tag-wrapper">
                      <span className="tag tag-group">
                        {isNameDifferent ? (
                          <>
                            <span className="group-name">{groupName}</span>
                            <span className="group-id-subtle">({groupId.substring(0, 8)}...)</span>
                          </>
                        ) : (
                          <span className="group-id-mono">{groupId}</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conflicts */}
          {hasConflicts && (
            <div className="rule-section">
              <div className="rule-section-label">⚠️ CONFLICTS DETECTED</div>
              {rule.conflicts!.map((conflict, idx) => (
                <div key={idx} className="conflict-item">
                  <div className={`conflict-severity conflict-${conflict.severity}`}>
                    {conflict.severity.toUpperCase()}
                  </div>
                  <div className="conflict-details">
                    <div>
                      Conflicts with: <strong>{conflict.rule2.name}</strong>
                    </div>
                    <div className="conflict-reason">{conflict.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Metadata */}
          <div className="rule-metadata">
            <div className="metadata-item">
              <span className="metadata-label">Last updated:</span>
              <span className="metadata-value">{timeAgo(rule.lastUpdated)}</span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Rule ID:</span>
              <span className="metadata-value metadata-id">{rule.id}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="rule-actions">
            {rule.status === 'ACTIVE' ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleDeactivate}
              >
                Deactivate Rule
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleActivate}
              >
                Activate Rule
              </button>
            )}
            {oktaOrigin && (
              <a
                href={`${oktaOrigin}/admin/groups#rules`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                title="Open Rules page in Okta Admin Console (you can search for this rule by name)"
              >
                View in Okta →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memoization
  return (
    prevProps.rule.id === nextProps.rule.id &&
    prevProps.rule.name === nextProps.rule.name &&
    prevProps.rule.status === nextProps.rule.status &&
    prevProps.rule.condition === nextProps.rule.condition &&
    prevProps.rule.affectsCurrentGroup === nextProps.rule.affectsCurrentGroup &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.oktaOrigin === nextProps.oktaOrigin &&
    (prevProps.rule.conflicts?.length || 0) === (nextProps.rule.conflicts?.length || 0)
  );
});

RuleCard.displayName = 'RuleCard';

export default RuleCard;
