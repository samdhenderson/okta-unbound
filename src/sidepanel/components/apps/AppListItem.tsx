import React, { useState, useCallback, memo } from 'react';
import type { AppSummary } from '../../../shared/types';
import { getProvisioningLabel } from '../../utils/appEnrichment';

interface AppListItemProps {
  app: AppSummary;
  selected: boolean;
  onToggleSelect: (appId: string) => void;
  onOpenInOkta?: (appId: string) => void;
  onEnrich?: (appId: string) => void;
  isEnriching?: boolean;
  oktaOrigin?: string;
}

/**
 * Premium, refined app list item with exceptional design quality.
 * Matches the sophisticated aesthetic of GroupListItem.
 */
const AppListItem: React.FC<AppListItemProps> = memo(({
  app,
  selected,
  onToggleSelect,
  onEnrich,
  isEnriching,
  oktaOrigin,
}) => {
  const [expanded, setExpanded] = useState(false);

  const getAppTypeBadge = (appType: AppSummary['appType']) => {
    const configs = {
      SAML_2_0: { label: 'SAML 2.0', gradient: 'from-[#007dc1] to-[#3d9dd9]', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      SAML_1_1: { label: 'SAML 1.1', gradient: 'from-[#007dc1] to-[#5da3d9]', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      OPENID_CONNECT: { label: 'OIDC', gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      WS_FEDERATION: { label: 'WS-Fed', gradient: 'from-purple-500 to-purple-600', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
      SWA: { label: 'SWA', gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      BROWSER_PLUGIN: { label: 'Plugin', gradient: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
      BOOKMARK: { label: 'Bookmark', gradient: 'from-gray-500 to-gray-600', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
      API_SERVICE: { label: 'API', gradient: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
      OTHER: { label: 'Other', gradient: 'from-gray-500 to-gray-600', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
    };
    return configs[appType] || configs.OTHER;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'ACTIVE') {
      return { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    }
    return { label: 'Inactive', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
  };

  const getProvisioningBadge = (status: AppSummary['provisioningStatus'], type?: AppSummary['provisioningType']) => {
    if (status === 'NOT_SUPPORTED') {
      return { label: '—', bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200' };
    }
    if (status === 'DISABLED') {
      return { label: 'Off', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
    }
    const label = getProvisioningLabel(status, type);
    return { label, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
  };

  const getPushGroupsBadge = (enabled: boolean, count?: number, errors?: number) => {
    if (!enabled) {
      return { label: 'Off', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
    }
    if (errors && errors > 0) {
      return { label: `Errors (${errors})`, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    }
    const label = count !== undefined ? `On (${count})` : 'On';
    return { label, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
  };

  const getCertBadge = (certStatus?: AppSummary['certStatus'], daysRemaining?: number) => {
    if (!certStatus || certStatus === 'NOT_APPLICABLE') {
      return { label: '—', bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200' };
    }
    if (certStatus === 'EXPIRED') {
      return { label: 'Expired', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    }
    if (certStatus === 'EXPIRING_SOON') {
      const label = daysRemaining !== undefined ? `${daysRemaining}d left` : 'Expiring';
      return { label, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    }
    return { label: 'OK', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
  };

  const handleOpenInOkta = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (oktaOrigin) {
      window.open(`${oktaOrigin}/admin/app/${app.name}/instance/${app.id}`, '_blank');
    }
  }, [oktaOrigin, app.id, app.name]);

  const handleToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleSelect(app.id);
  }, [onToggleSelect, app.id]);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  const typeBadge = getAppTypeBadge(app.appType);
  const statusBadge = getStatusBadge(app.status);
  const provisioningBadge = getProvisioningBadge(app.provisioningStatus, app.provisioningType);
  const pushGroupsBadge = getPushGroupsBadge(app.pushGroupsEnabled, app.pushGroupsCount, app.pushGroupsErrors);
  const certBadge = getCertBadge(app.certStatus, app.certDaysRemaining);

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

          {/* Main Content */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={toggleExpanded}>
            {/* App Name/Label */}
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-base font-semibold text-gray-900 truncate group-hover/item:text-[#007dc1] transition-colors">
                {app.label}
              </h3>
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {/* Status Badge */}
              <span className={`px-2.5 py-1 text-xs font-medium rounded-md border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                {statusBadge.label}
              </span>

              {/* App Type Badge */}
              <span className={`px-2.5 py-1 text-xs font-medium rounded-md border ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}`}>
                {typeBadge.label}
              </span>

              {/* Provisioning Badge */}
              <span className={`px-2.5 py-1 text-xs font-medium rounded-md border ${provisioningBadge.bg} ${provisioningBadge.text} ${provisioningBadge.border}`} title="Provisioning">
                <span className="mr-1">⚙️</span>
                {provisioningBadge.label}
              </span>

              {/* Push Groups Badge */}
              <span className={`px-2.5 py-1 text-xs font-medium rounded-md border ${pushGroupsBadge.bg} ${pushGroupsBadge.text} ${pushGroupsBadge.border}`} title="Push Groups">
                <span className="mr-1">🔄</span>
                {pushGroupsBadge.label}
              </span>

              {/* SAML Cert Badge */}
              {app.appType === 'SAML_2_0' || app.appType === 'SAML_1_1' ? (
                <span className={`px-2.5 py-1 text-xs font-medium rounded-md border ${certBadge.bg} ${certBadge.text} ${certBadge.border}`} title="SAML Certificate">
                  <span className="mr-1">🔒</span>
                  {certBadge.label}
                </span>
              ) : null}
            </div>

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium">{app.userAssignmentCount}</span>
                <span className="text-gray-500">users</span>
              </div>

              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-medium">{app.groupAssignmentCount}</span>
                <span className="text-gray-500">groups</span>
              </div>

              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-500">Updated {formatRelativeTime(app.lastUpdated)}</span>
              </div>
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
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-100 bg-gradient-to-b from-gray-50/30 to-white space-y-4 animate-in slide-in-from-top-2 duration-300">
          {/* App Details */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <span className="text-gray-500">App ID:</span>
              <span className="ml-2 font-mono text-xs text-gray-900">{app.id}</span>
            </div>
            <div>
              <span className="text-gray-500">Name:</span>
              <span className="ml-2 text-gray-900">{app.name}</span>
            </div>
            <div>
              <span className="text-gray-500">Created:</span>
              <span className="ml-2 text-gray-900">{new Date(app.created).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-gray-500">Last Updated:</span>
              <span className="ml-2 text-gray-900">{new Date(app.lastUpdated).toLocaleDateString()}</span>
            </div>
            {app.certExpiresAt && (
              <div>
                <span className="text-gray-500">Cert Expires:</span>
                <span className="ml-2 text-gray-900">{new Date(app.certExpiresAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Assignment Summary */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">Assignments</h4>
              {onEnrich && app.totalAssignmentCount === 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnrich(app.id);
                  }}
                  disabled={isEnriching}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] rounded-md hover:from-[#005a8f] hover:to-[#007dc1] transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Fetch real assignment counts, certificates, and provisioning details"
                >
                  {isEnriching ? (
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enriching...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Enrich Data
                    </span>
                  )}
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-gray-700">{app.totalAssignmentCount} total</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-gray-700">{app.userAssignmentCount} users</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-gray-700">{app.groupAssignmentCount} groups</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AppListItem.displayName = 'AppListItem';

export default AppListItem;

// Utility function for relative time (duplicated from GroupListItem for now)
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}
