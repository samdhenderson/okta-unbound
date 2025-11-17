import React, { useState } from 'react';
import type { FormattedRule } from '../../shared/types';
import { timeAgo } from '../../shared/ruleUtils';

interface RuleCardProps {
  rule: FormattedRule;
  onActivate?: (ruleId: string) => void;
  onDeactivate?: (ruleId: string) => void;
}

const RuleCard: React.FC<RuleCardProps> = ({ rule, onActivate, onDeactivate }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusColor = rule.status === 'ACTIVE' ? 'success' : 'inactive';
  const hasConflicts = rule.conflicts && rule.conflicts.length > 0;

  return (
    <div className={`rule-card ${rule.affectsCurrentGroup ? 'affects-current' : ''}`}>
      {/* Header */}
      <div className="rule-header" onClick={() => setIsExpanded(!isExpanded)}>
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
              <code>{rule.conditionExpression || rule.condition}</code>
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
                onClick={() => onDeactivate?.(rule.id)}
              >
                Deactivate Rule
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onActivate?.(rule.id)}
              >
                Activate Rule
              </button>
            )}
            <a
              href={`${window.location.origin}/admin/groups/rules/${rule.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              Edit in Okta →
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default RuleCard;
