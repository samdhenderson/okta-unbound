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
 * Premium, refined group list item with exceptional design quality.
 * Matches the sophisticated aesthetic of the Overview tab.
 */
const GroupListItem: React.FC<GroupListItemProps> = memo(({
  group,
  selected,
  onToggleSelect,
  oktaOrigin,
}) => {
  const [expanded, setExpanded] = useState(false);

  const getTypeBadge = (type: string) => {
    const configs = {
      OKTA_GROUP: { label: 'OKTA', gradient: 'from-[#007dc1] to-[#3d9dd9]', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      APP_GROUP: { label: 'APP', gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      BUILT_IN: { label: 'BUILT-IN', gradient: 'from-gray-500 to-gray-600', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
    };
    return configs[type as keyof typeof configs] || configs.BUILT_IN;
  };

  const getHealthColor = (score?: number) => {
    if (!score) return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
    if (score >= 80) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    if (score >= 60) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
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

  const typeBadge = getTypeBadge(group.type);
  const healthColor = getHealthColor(group.healthScore);

  return (
    <div
      className={`
        group/item relative overflow-hidden rounded-xl border transition-all duration-300
        ${selected
          ? 'border-[#007dc1] bg-gradient-to-br from-blue-50/50 to-white ring-2 ring-[#007dc1]/20 shadow-lg shadow-[#007dc1]/10'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
        }
        ${expanded ? 'shadow-lg' : 'shadow-sm'}
      `}
      style={{ fontFamily: 'var(--font-primary)' }}
    >
      {/* Subtle background gradient */}
      <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-gray-50/30 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <div className="relative p-5">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <div className="flex items-center pt-0.5" onClick={(e) => e.stopPropagation()}>
            <label className="relative flex items-center cursor-pointer group/checkbox">
              <input
                type="checkbox"
                checked={selected}
                onChange={handleToggle}
                className="
                  peer w-5 h-5 rounded border-2 border-gray-300
                  checked:border-[#007dc1] checked:bg-gradient-to-br checked:from-[#007dc1] checked:to-[#3d9dd9]
                  transition-all duration-200 cursor-pointer
                  hover:border-[#007dc1]/50
                  focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:ring-offset-2
                  appearance-none
                "
              />
              <svg
                className="absolute w-3 h-3 left-1 top-1 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </label>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={toggleExpanded}>
            {/* Title Row */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 truncate mb-2 group-hover/item:text-[#007dc1] transition-colors">
                  {group.name}
                </h3>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {/* Type Badge */}
                  <span className={`
                    px-2.5 py-1 rounded-md text-xs font-bold border
                    ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}
                  `}>
                    {typeBadge.label}
                  </span>

                  {/* Push Destination Badges */}
                  {group.isPushGroup && group.linkedGroups && group.linkedGroups.length > 0 && (
                    <>
                      {group.linkedGroups.slice(0, 2).map((linkedGroup, idx) => (
                        <span
                          key={linkedGroup.id || idx}
                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-200 inline-flex items-center gap-1"
                          title={`Pushed to ${linkedGroup.sourceAppName || 'App'}`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          {linkedGroup.sourceAppName || 'App'}
                        </span>
                      ))}
                      {group.linkedGroups.length > 2 && (
                        <span
                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-200"
                          title={`Also pushed to: ${group.linkedGroups.slice(2).map(lg => lg.sourceAppName || 'App').join(', ')}`}
                        >
                          +{group.linkedGroups.length - 2}
                        </span>
                      )}
                    </>
                  )}

                  {/* Source App Badge */}
                  {group.type === 'APP_GROUP' && group.sourceAppName && (
                    <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                      {group.sourceAppName}
                    </span>
                  )}

                  {/* Stale Badge */}
                  {group.isStale && (
                    <span
                      className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1 animate-pulse"
                      title={`Stale: ${group.stalenessReasons?.join(', ')}`}
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      STALE
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {oktaOrigin && (
                  <button
                    onClick={handleOpenInOkta}
                    className="p-2 text-gray-400 hover:text-[#007dc1] hover:bg-blue-50 rounded-lg transition-all duration-200"
                    title="Open in Okta"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded();
                  }}
                  className="p-2 text-gray-400 hover:text-[#007dc1] hover:bg-blue-50 rounded-lg transition-all duration-200"
                  title={expanded ? 'Collapse' : 'Expand'}
                >
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
              {/* Member Count */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-md border border-gray-200">
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="font-semibold text-gray-900">{group.memberCount}</span>
                <span>member{group.memberCount !== 1 ? 's' : ''}</span>
              </div>

              {/* Rule Count */}
              {group.hasRules && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-md border border-blue-200">
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="font-semibold text-blue-700">{group.ruleCount}</span>
                  <span className="text-blue-600">rule{group.ruleCount !== 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Health Score */}
              {group.healthScore !== undefined && (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${healthColor.bg} ${healthColor.text} ${healthColor.border}`}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold">{group.healthScore}%</span>
                </div>
              )}

              {/* Last Activity */}
              {group.lastMembershipUpdated && (
                <div className="inline-flex items-center gap-1.5" title="Last membership change">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formatRelativeTime(group.lastMembershipUpdated)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-100 bg-gradient-to-b from-gray-50/30 to-white space-y-4 animate-in slide-in-from-top-2 duration-300">
          {/* Description */}
          {group.description && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Description</div>
              <p className="text-sm text-gray-700 leading-relaxed">{group.description}</p>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <div className="text-xs font-semibold text-gray-600 mb-1">Group ID</div>
              <code className="text-xs font-mono text-gray-800 bg-gray-50 px-2 py-1 rounded">{group.id}</code>
            </div>

            {group.lastUpdated && (
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <div className="text-xs font-semibold text-gray-600 mb-1">Last Updated</div>
                <div className="text-sm text-gray-900">{new Date(group.lastUpdated).toLocaleString()}</div>
              </div>
            )}

            {group.created && (
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <div className="text-xs font-semibold text-gray-600 mb-1">Created</div>
                <div className="text-sm text-gray-900">{new Date(group.created).toLocaleString()}</div>
              </div>
            )}

            {group.lastMembershipUpdated && (
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <div className="text-xs font-semibold text-gray-600 mb-1">Last Membership Change</div>
                <div className="text-sm text-gray-900">{new Date(group.lastMembershipUpdated).toLocaleString()}</div>
              </div>
            )}
          </div>

          {/* Staleness Details */}
          {group.stalenessScore !== undefined && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-semibold text-amber-900">Staleness Score: {group.stalenessScore}/100</span>
              </div>
              {group.stalenessReasons && group.stalenessReasons.length > 0 && (
                <ul className="space-y-1 ml-6">
                  {group.stalenessReasons.map((reason, idx) => (
                    <li key={idx} className="text-sm text-amber-800 list-disc">{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Push Group Details */}
          {group.isPushGroup && group.linkedGroups && group.linkedGroups.length > 0 && (
            <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span className="text-sm font-semibold text-cyan-900">Pushed to Applications</span>
              </div>
              <ul className="space-y-2">
                {group.linkedGroups.map(lg => (
                  <li key={lg.id} className="flex items-center gap-2 text-sm text-cyan-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    <span className="font-medium">{lg.sourceAppName || 'Unknown App'}</span>
                    <span className="text-xs text-cyan-600">(Active push mapping)</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-cyan-700 italic">
                Members of this group are automatically synced to the above applications.
              </p>
            </div>
          )}

          {/* Source App */}
          {group.type === 'APP_GROUP' && group.sourceAppName && (
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-xs font-semibold text-purple-600 mb-1">Source Application</div>
              <div className="text-sm font-medium text-purple-900">{group.sourceAppName}</div>
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
