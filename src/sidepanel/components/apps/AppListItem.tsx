/**
 * @module sidepanel/components/apps/AppListItem
 * @description A single expandable, read-only row in the Applications list.
 *
 * Collapsed, it shows the app's display label, its status badge, the app key and
 * sign-on mode, and the created date. Expanded, it reveals the ids/dates and —
 * lazily, only once opened — the app's user/group assignment counts, plus an
 * "Open in Okta" deep link. Memoised so unaffected rows skip re-render.
 */
import React, { memo, useCallback, useState } from 'react';
import { IconButton, LoadingSpinner, OpenInOktaLink } from '../shared';
import { useEntityQuery } from '../../cache/useEntityQuery';
import { cacheKeys } from '../../cache/keys';
import type { AppAssignmentCounts } from '../../hooks/useOktaApi/appOperations';
import type { OktaAppListItem } from '../../../shared/schemas/okta';
import { formatDate, formatDateShort } from '../../../shared/utils/dateFormat';
import { appDisplayLabel, appStatusVariant, type AppStatusVariant } from './appFilters';

/** Badge token classes per status variant (`danger`, never `error` — ADR-0002). */
const STATUS_BADGE: Record<AppStatusVariant, string> = {
  success: 'bg-success-light text-success-text border-success-light',
  danger: 'bg-danger-light text-danger-text border-danger-light',
  neutral: 'bg-neutral-50 text-neutral-700 border-neutral-200',
};

/** Props for {@link AppListItem}. */
export interface AppListItemProps {
  /** The app to render. */
  app: OktaAppListItem;
  /** Okta org origin, enabling the "Open in Okta" deep link when present. */
  oktaOrigin?: string;
  /**
   * Loads this app's assignment counts. Called only once the row is expanded (the
   * walk costs one request per 200 assignments), and cached by app id. Must be
   * stable — it is a memo dependency of the row's query.
   */
  fetchAssignmentCounts?: (appId: string) => Promise<AppAssignmentCounts | null>;
}

/** The lazily-loaded users/groups assignment summary shown in an expanded row. */
const AssignmentCounts: React.FC<{
  appId: string;
  enabled: boolean;
  fetchAssignmentCounts: (appId: string) => Promise<AppAssignmentCounts | null>;
}> = ({ appId, enabled, fetchAssignmentCounts }) => {
  // Same key, same shape as the app Overview's own counts read
  // (`useAppOverviewData`): both screens are mounted at once (ADR-0018), so sharing
  // one entry means whichever the user reaches first warms the other — and, unlike
  // the two-shapes-one-key arrangement this replaced, neither can corrupt the other.
  const { data, isLoading, error } = useEntityQuery<AppAssignmentCounts | null>(
    cacheKeys.appAssignmentCounts(appId),
    () => fetchAssignmentCounts(appId),
    { enabled },
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <LoadingSpinner size="sm" />
        <span>Counting assignments…</span>
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-xs text-neutral-500">Assignment counts unavailable.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="px-2 py-0.5 rounded-md font-medium bg-primary-light text-primary-text border border-primary-highlight">
        {data.users.toLocaleString()} user{data.users === 1 ? '' : 's'}
      </span>
      <span className="px-2 py-0.5 rounded-md font-medium bg-primary-light text-primary-text border border-primary-highlight">
        {data.groups.toLocaleString()} group{data.groups === 1 ? '' : 's'}
      </span>
    </div>
  );
};

/** Memoised expandable row for one application. */
const AppListItem: React.FC<AppListItemProps> = memo(
  ({ app, oktaOrigin, fetchAssignmentCounts }) => {
    const [expanded, setExpanded] = useState(false);
    const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

    const label = appDisplayLabel(app);
    const status = app.status ?? 'UNKNOWN';

    return (
      <div
        data-app-id={app.id}
        className="group/item relative overflow-hidden rounded-md border border-neutral-200 bg-white hover:border-neutral-500 transition-all duration-100"
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0 cursor-pointer" onClick={toggleExpanded}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-neutral-900 truncate group-hover/item:text-primary-text transition-colors duration-100">
                    {label}
                  </h3>

                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_BADGE[appStatusVariant(app.status)]}`}
                    >
                      {status}
                    </span>
                    {app.signOnMode && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-neutral-50 text-neutral-700 border border-neutral-200">
                        {app.signOnMode}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <IconButton
                    label={expanded ? 'Collapse' : 'Expand'}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded();
                    }}
                    variant="ghost"
                    size="md"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform duration-100 ${expanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </IconButton>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-neutral-500">
                {app.name && <span className="truncate">{app.name}</span>}
                {app.created && <span title="Created">Created {formatDateShort(app.created)}</span>}
              </div>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="px-4 pb-4 pt-2 border-t border-neutral-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-neutral-50 rounded-md border border-neutral-200">
                <div className="text-xs font-medium text-neutral-600 mb-0.5">Application ID</div>
                <code className="text-xs font-mono text-neutral-900 break-all">{app.id}</code>
              </div>

              {app.signOnMode && (
                <div className="p-2 bg-neutral-50 rounded-md border border-neutral-200">
                  <div className="text-xs font-medium text-neutral-600 mb-0.5">Sign-on mode</div>
                  <div className="text-xs text-neutral-900">{app.signOnMode}</div>
                </div>
              )}

              {app.created && (
                <div className="p-2 bg-neutral-50 rounded-md border border-neutral-200">
                  <div className="text-xs font-medium text-neutral-600 mb-0.5">Created</div>
                  <div className="text-xs text-neutral-900">{formatDate(app.created)}</div>
                </div>
              )}

              {app.lastUpdated && (
                <div className="p-2 bg-neutral-50 rounded-md border border-neutral-200">
                  <div className="text-xs font-medium text-neutral-600 mb-0.5">Last updated</div>
                  <div className="text-xs text-neutral-900">{formatDate(app.lastUpdated)}</div>
                </div>
              )}
            </div>

            {fetchAssignmentCounts && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-neutral-600">Assignments</div>
                <AssignmentCounts
                  appId={app.id}
                  enabled={expanded}
                  fetchAssignmentCounts={fetchAssignmentCounts}
                />
              </div>
            )}

            <OpenInOktaLink oktaOrigin={oktaOrigin} entityType="app" entityId={app.id} />
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.app === next.app &&
    prev.oktaOrigin === next.oktaOrigin &&
    prev.fetchAssignmentCounts === next.fetchAssignmentCounts,
);

AppListItem.displayName = 'AppListItem';

export default AppListItem;
