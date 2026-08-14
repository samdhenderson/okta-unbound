/**
 * @module sidepanel/components/apps/AppListItem
 * @description A single expandable, read-only row in the Applications list.
 *
 * Collapsed, it shows the app's display label, its status badge, the app key and
 * sign-on mode, and the created date. Expanded, it reveals the ids/dates and —
 * lazily, only once opened — the app's user/group assignment counts, plus an
 * "Open in Okta" deep link. Memoised so unaffected rows skip re-render.
 *
 * The card itself is a {@link sidepanel/components/shared/ListRow} at
 * `comfortable` density — this row owns its interior only, never its chrome
 * (ADR-0029).
 *
 * **The row body is keyboard-activatable.** It used to be a `<div onClick>` with
 * no role, no `tabIndex` and no focus ring — one of the five a11y gaps ADR-0029
 * catalogued. It is now a {@link sidepanel/components/shared/StretchedButton}
 * overlay: a real button, so Enter/Space and the focus ring come for free, and
 * the row's own controls (the chevron `IconButton`, the expanded "Open in Okta"
 * link) stay legal rather than becoming axe `nested-interactive` violations the
 * way `as="button"` would. The overlay is scoped to the **header** — `relative`
 * sits on `ListRow`'s header wrapper, not on the card — so clicking inside the
 * expanded panel does not collapse the row out from under the user.
 */
import React, { memo, useCallback, useId, useState } from 'react';
import { IconButton, ListRow, LoadingSpinner, OpenInOktaLink, StretchedButton } from '../shared';
import Icon from '../overview/shared/Icon';
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
    const detailsId = useId();
    // Every card in the list shares the overlay's label, so it points at this
    // card's own title: screen readers read "Expand app, Salesforce".
    const titleId = useId();
    const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

    const label = appDisplayLabel(app);
    const status = app.status ?? 'UNKNOWN';

    return (
      /*
        `ListRow` owns the card's border, radius, hover and padding (ADR-0029).
        The padding boundary is the reason this row passes `body` rather than
        putting the disclose panel in `children`: with `body` the density padding
        moves off the card and onto a wrapper around the header only, so the
        panel keeps its own `px-4 pb-4 pt-2` and its separator still runs edge to
        edge. `ListRow` also supplies `overflow-hidden` in that mode, so a body
        animating from `0fr` clips against the rounded corners. Only `group/item`
        stays in `className` — layout and behaviour, not chrome.
      */
      <ListRow
        density="comfortable"
        // Activated by the `StretchedButton` overlay below, which `ListRow`
        // cannot see — without this the row would read as static and lose its
        // hover border. Deliberately not `as="button"`: the row holds an
        // `IconButton` and an "Open in Okta" link, so a real button here is an
        // axe `nested-interactive`.
        interactive
        dataAttributes={{ 'data-app-id': app.id }}
        className="group/item"
        // `relative` belongs to the *header wrapper*, not the card: the overlay
        // is `absolute inset-0` against its nearest positioned ancestor, and on
        // the card it would stretch over the expanded panel too — so clicking a
        // detail, or the "Open in Okta" link, would collapse the row. Scoped
        // here it covers exactly the header, padding included.
        headerClassName="relative flex items-start gap-3"
        body={
          /*
            `.disclose` animates `grid-template-rows` between 0fr and 1fr, so the
            body collapses to zero height with no JS measurement and stays mounted
            while closed (held out of the tab order and accessible tree via
            `inert`) rather than unmounting — `AssignmentCounts`' own
            `enabled={expanded}` gate is what keeps its fetch from firing until
            the row is actually opened.
          */
          <div
            id={detailsId}
            className="disclose"
            data-open={expanded}
            inert={!expanded || undefined}
          >
            <div>
              <div className="px-4 pb-4 pt-2 border-t border-neutral-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-neutral-50 rounded-md border border-neutral-200">
                    <div className="text-xs font-medium text-neutral-600 mb-0.5">
                      Application ID
                    </div>
                    <code className="text-xs font-mono text-neutral-900 break-all">{app.id}</code>
                  </div>

                  {app.signOnMode && (
                    <div className="p-2 bg-neutral-50 rounded-md border border-neutral-200">
                      <div className="text-xs font-medium text-neutral-600 mb-0.5">
                        Sign-on mode
                      </div>
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
                      <div className="text-xs font-medium text-neutral-600 mb-0.5">
                        Last updated
                      </div>
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
            </div>
          </div>
        }
      >
        {/*
          The row body's activation: an invisible button covering the header, so
          the whole header is clickable *and* reachable by keyboard without the
          content itself becoming button content (see the module header).
        */}
        <StretchedButton
          label={expanded ? 'Collapse app' : 'Expand app'}
          describedBy={titleId}
          title={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
          onClick={toggleExpanded}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3
                id={titleId}
                className="text-sm font-semibold text-neutral-900 truncate group-hover/item:text-primary-text transition-colors duration-(--dur-instant)"
              >
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

            {/*
              `relative z-10` lifts the chevron above the overlay — without it
              the `StretchedButton` sits on top and swallows its clicks. It no
              longer needs to `stopPropagation`: the overlay is a sibling now,
              not an ancestor, so a chevron click cannot also reach it.
            */}
            <div className="relative z-10 flex items-center gap-1 shrink-0">
              <IconButton
                label={expanded ? 'Collapse' : 'Expand'}
                onClick={toggleExpanded}
                variant="ghost"
                size="md"
                expanded={expanded}
                controls={detailsId}
              >
                {/*
                  The registry glyph, rotated rather than swapped for a
                  `chevron-down`: the rotation is what animates the open/close.
                */}
                <Icon
                  type="chevron-right"
                  size="sm"
                  className={`transition-transform duration-(--dur-instant) ${expanded ? 'rotate-90' : ''}`}
                />
              </IconButton>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
            {app.name && <span className="truncate font-mono text-neutral-500">{app.name}</span>}
            {app.created && (
              <span className="text-neutral-600" title="Created">
                Created {formatDateShort(app.created)}
              </span>
            )}
          </div>
        </div>
      </ListRow>
    );
  },
  (prev, next) =>
    prev.app === next.app &&
    prev.oktaOrigin === next.oktaOrigin &&
    prev.fetchAssignmentCounts === next.fetchAssignmentCounts,
);

AppListItem.displayName = 'AppListItem';

export default AppListItem;
