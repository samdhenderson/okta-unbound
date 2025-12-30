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
          <span className="font-mono text-xs text-gray-600">{groupId}</span>
          <span
            className="ml-2 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200"
            title={`Group: ${groupName}`}
          >
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

  const hasConflicts = rule.conflicts && rule.conflicts.length > 0;

  return (
    <div
      className={`
        bg-white rounded-lg border shadow-sm transition-all duration-300 overflow-hidden
        ${rule.affectsCurrentGroup ? 'border-[#007dc1] shadow-[#007dc1]/10' : 'border-gray-200'}
        ${isHighlighted ? 'ring-2 ring-[#007dc1] ring-offset-2' : ''}
        hover:shadow-md
      `}
      style={{ fontFamily: 'var(--font-primary)' }}
    >
      {/* Header */}
      <div
        className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors duration-200 flex items-center justify-between gap-4"
        onClick={toggleExpanded}
      >
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className={`
            mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0
            ${rule.status === 'ACTIVE' ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-gray-400 ring-4 ring-gray-400/20'}
          `} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h3 className="font-semibold text-gray-900 text-base">{rule.name}</h3>
              {rule.affectsCurrentGroup && (
                <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white text-xs font-bold">
                  Current Group
                </span>
              )}
              {hasConflicts && (
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
                  ⚠️ {rule.conflicts!.length} Conflict{rule.conflicts!.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 truncate">{rule.condition}</p>
          </div>
        </div>
        <button
          className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100 flex-shrink-0"
          type="button"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2 space-y-5 bg-gradient-to-b from-gray-50/30 to-white border-t border-gray-100">
          {/* Condition */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">WHEN</div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <code className="text-sm text-gray-800 font-mono block overflow-x-auto">
                {renderConditionWithGroupBadges(
                  rule.conditionExpression || rule.condition,
                  rule.allGroupNamesMap
                )}
              </code>
            </div>
          </div>

          {/* User Attributes */}
          {rule.userAttributes.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">USES ATTRIBUTES</div>
              <div className="flex flex-wrap gap-2">
                {rule.userAttributes.map((attr) => (
                  <span
                    key={attr}
                    className="px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 text-sm font-medium border border-blue-200"
                  >
                    {attr}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {rule.groupIds.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">THEN ADD TO GROUPS</div>
              <div className="flex flex-wrap gap-2">
                {rule.groupIds.map((groupId, index) => {
                  const groupName = rule.groupNames?.[index];
                  const isNameDifferent = groupName && groupName !== groupId;

                  return (
                    <span
                      key={groupId}
                      className="px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-200"
                    >
                      {isNameDifferent ? (
                        <>
                          <span className="font-semibold">{groupName}</span>
                          <span className="ml-1.5 text-xs text-emerald-600 font-mono">({groupId.substring(0, 8)}...)</span>
                        </>
                      ) : (
                        <span className="font-mono">{groupId}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conflicts */}
          {hasConflicts && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-3">⚠️ CONFLICTS DETECTED</div>
              <div className="space-y-3">
                {rule.conflicts!.map((conflict, idx) => (
                  <div key={idx} className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-3">
                      <span className={`
                        px-2 py-1 rounded text-xs font-bold uppercase
                        ${conflict.severity === 'high' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}
                      `}>
                        {conflict.severity}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm text-gray-900 mb-1">
                          Conflicts with: <span className="font-semibold">{conflict.rule2.name}</span>
                        </div>
                        <div className="text-xs text-gray-600">{conflict.reason}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-gray-200 flex flex-wrap gap-4 text-xs text-gray-600">
            <div>
              <span className="font-semibold">Last updated:</span>{' '}
              <span>{timeAgo(rule.lastUpdated)}</span>
            </div>
            <div>
              <span className="font-semibold">Rule ID:</span>{' '}
              <span className="font-mono text-gray-500">{rule.id}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {rule.status === 'ACTIVE' ? (
              <button
                className="px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                onClick={handleDeactivate}
              >
                Deactivate Rule
              </button>
            ) : (
              <button
                className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white rounded-lg hover:from-[#005a8f] hover:to-[#007dc1] transition-all duration-200 shadow-md hover:shadow-lg"
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
                className="px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm inline-flex items-center gap-2"
                title="Open Rules page in Okta Admin Console (you can search for this rule by name)"
              >
                <span>View in Okta</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
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
