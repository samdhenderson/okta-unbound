import React, { useState, useCallback, memo } from 'react';
import type { GroupSummary } from '../../../shared/types';

interface GroupListItemProps {
  group: GroupSummary;
  selected: boolean;
  onToggleSelect: (groupId: string) => void;
  oktaOrigin?: string;
}

const GroupListItem: React.FC<GroupListItemProps> = memo(({
  group,
  selected,
  onToggleSelect,
  oktaOrigin,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

  const getTypeBadge = (type: string) => {
    const configs = {
      OKTA_GROUP: { label: 'OKTA', bg: 'bg-primary-light', text: 'text-primary-text', border: 'border-primary-highlight' },
      APP_GROUP: { label: 'APP', bg: 'bg-warning-light', text: 'text-warning-text', border: 'border-warning-light' },
      BUILT_IN: { label: 'BUILT-IN', bg: 'bg-neutral-50', text: 'text-neutral-700', border: 'border-neutral-200' },
    };
    return configs[type as keyof typeof configs] || configs.BUILT_IN;
  };

  const handleOpenInOkta = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (oktaOrigin) {
      window.open(`${oktaOrigin}/admin/group/${group.id}`, '_blank');
    }
  }, [oktaOrigin, group.id]);

  const handleToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleSelect(group.id);
  }, [onToggleSelect, group.id]);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  const handleCopyId = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(group.id).then(() => {
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1500);
    });
  }, [group.id]);

  const typeBadge = getTypeBadge(group.type);

  return (
    <div
      className={`
        group/item relative overflow-hidden rounded-md border transition-all duration-100
        ${selected
          ? 'border-primary bg-primary-light ring-1 ring-primary/20'
          : 'border-neutral-200 bg-white hover:border-neutral-500'
        }
      `}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="flex items-center pt-0.5" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected}
              onChange={handleToggle}
              className="w-4 h-4 rounded border-neutral-500 text-primary focus:ring-primary cursor-pointer accent-primary"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={toggleExpanded}>
            {/* Title Row */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-neutral-900 truncate group-hover/item:text-primary-text transition-colors duration-100">
                  {group.name}
                </h3>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}`}>
                    {typeBadge.label}
                  </span>

                  {group.type === 'APP_GROUP' && group.sourceAppName && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-primary-light text-primary-text border border-primary-highlight">
                      {group.sourceAppName}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {oktaOrigin && (
                  <button
                    onClick={handleOpenInOkta}
                    className="p-1.5 text-neutral-400 hover:text-primary-text hover:bg-primary-light rounded-md transition-colors duration-100"
                    title="Open in Okta"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
                  className="p-1.5 text-neutral-400 hover:text-primary-text hover:bg-primary-light rounded-md transition-colors duration-100"
                  title={expanded ? 'Collapse' : 'Expand'}
                >
                  <svg
                    className={`w-4 h-4 transition-transform duration-100 ${expanded ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
              <div className="inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="font-medium text-neutral-700">{group.memberCount}</span>
                <span>member{group.memberCount !== 1 ? 's' : ''}</span>
              </div>

              {group.hasRules && (
                <div className="inline-flex items-center gap-1 text-primary-text">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="font-medium">{group.ruleCount}</span>
                  <span>rule{group.ruleCount !== 1 ? 's' : ''}</span>
                </div>
              )}

              {group.lastMembershipUpdated && (
                <div className="inline-flex items-center gap-1" title="Last membership change">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{new Date(group.lastMembershipUpdated).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-neutral-100 space-y-3">
          {group.description && (
            <div>
              <div className="text-xs font-medium text-neutral-600 mb-1">Description</div>
              <p className="text-sm text-neutral-700">{group.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="p-2 bg-neutral-50 rounded-md border border-neutral-200">
              <div className="text-xs font-medium text-neutral-600 mb-0.5">Group ID</div>
              <div className="flex items-center gap-1.5">
                <code className="text-xs font-mono text-neutral-900 truncate">{group.id}</code>
                <button
                  onClick={handleCopyId}
                  className="shrink-0 p-0.5 text-neutral-400 hover:text-primary-text rounded transition-colors duration-100"
                  title={idCopied ? 'Copied!' : 'Copy ID'}
                >
                  {idCopied ? (
                    <svg className="w-3.5 h-3.5 text-success-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M8 5a2 2 0 002 2h4a2 2 0 002-2M8 5a2 2 0 012-2h4a2 2 0 012 2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {group.lastUpdated && (
              <div className="p-2 bg-neutral-50 rounded-md border border-neutral-200">
                <div className="text-xs font-medium text-neutral-600 mb-0.5">Last Updated</div>
                <div className="text-xs text-neutral-900">{new Date(group.lastUpdated).toLocaleString()}</div>
              </div>
            )}

            {group.created && (
              <div className="p-2 bg-neutral-50 rounded-md border border-neutral-200">
                <div className="text-xs font-medium text-neutral-600 mb-0.5">Created</div>
                <div className="text-xs text-neutral-900">{new Date(group.created).toLocaleString()}</div>
              </div>
            )}

            {group.lastMembershipUpdated && (
              <div className="p-2 bg-neutral-50 rounded-md border border-neutral-200">
                <div className="text-xs font-medium text-neutral-600 mb-0.5">Last Membership Change</div>
                <div className="text-xs text-neutral-900">{new Date(group.lastMembershipUpdated).toLocaleString()}</div>
              </div>
            )}
          </div>

          {group.type === 'APP_GROUP' && group.sourceAppName && (
            <div className="p-2 bg-primary-light rounded-md border border-primary-highlight">
              <div className="text-xs font-medium text-primary-text mb-0.5">Source Application</div>
              <div className="text-sm font-medium text-primary-dark">{group.sourceAppName}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.group.id === nextProps.group.id &&
    prevProps.group.name === nextProps.group.name &&
    prevProps.group.memberCount === nextProps.group.memberCount &&
    prevProps.group.type === nextProps.group.type &&
    prevProps.group.hasRules === nextProps.group.hasRules &&
    prevProps.group.ruleCount === nextProps.group.ruleCount &&
    prevProps.selected === nextProps.selected &&
    prevProps.oktaOrigin === nextProps.oktaOrigin
  );
});

GroupListItem.displayName = 'GroupListItem';

export default GroupListItem;
