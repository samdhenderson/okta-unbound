/**
 * @module sidepanel/components/HomeTab
 * @description The side panel's first tab: a jump bar over the org.
 *
 * Home replaces the Overview tab, and the swap is a change of job rather than a
 * redesign. Overview was *passive* — it described whatever entity the browser
 * happened to be showing, and paid for that description with requests on every
 * open. Home is the opposite: the reader says what they want, and every fact on
 * the tab either arrives free, arrives in one list request, or is a button.
 *
 * This component composes and does not fetch. It owns the wiring — which
 * searchers exist, where a result goes — and delegates behaviour to
 * {@link module:sidepanel/hooks/useJumpResolver} and the request cost to
 * {@link module:sidepanel/hooks/useOrgEntityIndex}.
 *
 * ## The fan-out is derived from reachability, not hardcoded
 *
 * `searchers` is built from `canNavigateTo`, so this build searches exactly the
 * kinds it can open. Adding an `app` navigation handler in `App.tsx` gives the
 * jump bar app search with no edit here — and, more importantly, it is
 * structurally impossible for the bar to return a row that does nothing when
 * pressed. Ids are exempt: a pasted id is always resolved, because the reader
 * asked for that exact thing, and an unreachable one still gets an
 * "Open in Okta" route.
 *
 * ## The reports mount nothing of their own
 *
 * `useHomeReports` takes the same snapshot handles the jump bar and the org card
 * already hold, so both reports under the card are joins over rows on disk. It
 * deliberately owns no sync ladder: `useOrgFigures` owns the single top-up Home
 * is allowed to spend per mount, and a second consumer deciding independently
 * that the snapshot looked stale would double it.
 *
 * ## No `PageHeader`
 *
 * Deliberate, per the design: a header on Home could only say "Home". The jump
 * bar is the first thing in the scroller. `TabPanel` already supplies
 * `data-header-scope` and the app scroller already carries
 * `[overflow-anchor:none]`, so the shell contract needs nothing from here.
 */
import React, { useMemo, useState } from 'react';
import JumpBar from './home/JumpBar';
import WorkingSet from './home/WorkingSet';
import OrgSnapshotCard from './home/OrgSnapshotCard';
import ReportsCard from './home/ReportsCard';
import { useOktaApi } from '../hooks/useOktaApi';
import { useOrgEntityIndex } from '../hooks/useOrgEntityIndex';
import { useWorkingSet } from '../hooks/useWorkingSet';
import { useOrgFigures } from '../hooks/useOrgFigures';
import { useHomeReports } from '../hooks/useHomeReports';
import { useJumpResolver, type JumpResult } from '../hooks/useJumpResolver';
import { useEntityNavigation } from '../contexts/NavigationContext';
import { navigationTarget } from './home/jumpDestinations';
import type { OktaIdKind } from '../../shared/utils/oktaId';
import type { WorkingSetRef } from '../../shared/storage/workingSetStore';
import type { ListViewRequest, ListViewTab } from '../listViewRequest';

/** Props for {@link HomeTab}. */
export interface HomeTabProps {
  /**
   * Whether this tab is the one on screen. Every tab stays mounted (ADR-0018),
   * so this gates the search and the snapshot sync — a hidden tab issues no
   * Okta traffic.
   */
  isActive: boolean;
  /** Browser tab hosting the Okta session; every request is routed to it. */
  targetTabId: number | null;
  /** Okta org origin, for deep links and for scoping the org snapshot. */
  oktaOrigin?: string | null;
  /**
   * Open a list tab with one filter already applied — what the org card's
   * sub-counts do. See {@link module:sidepanel/listViewRequest}.
   */
  onOpenListView: (request: ListViewRequest) => void;
  /** Open a list tab unfiltered — what an org card headline does. */
  onOpenTab: (tab: ListViewTab) => void;
}

/**
 * Render the Home tab.
 *
 * @param props - See {@link HomeTabProps}.
 */
const HomeTab: React.FC<HomeTabProps> = ({
  isActive,
  targetTabId,
  oktaOrigin,
  onOpenListView,
  onOpenTab,
}) => {
  const api = useOktaApi({ targetTabId, oktaOrigin });
  const nav = useEntityNavigation();

  const index = useOrgEntityIndex({ oktaOrigin, targetTabId, enabled: isActive });
  const workingSet = useWorkingSet(oktaOrigin);
  const orgFigures = useOrgFigures({
    index,
    enabled: isActive,
    connected: targetTabId !== null,
  });
  // No `enabled` and no sync of its own: both reports are joins over the rows
  // `useOrgFigures` already mounted, and it owns the single top-up Home is
  // allowed to spend. A second consumer deciding independently that the
  // snapshot looked stale would double it.
  const { reports } = useHomeReports({ index });

  // Captured once, at mount. React applies `autoFocus` on mount only, and the
  // tab is never unmounted, so this cannot re-steal focus from the rail button
  // on a later return to Home. Gated on visibility because a panel that is
  // open-but-hidden must not pull focus when it is eventually shown.
  const [autoFocus] = useState(() => isActive && document.visibilityState === 'visible');

  const { searchUsers, searchGroups, getUserById, getGroupById, getAppById, getRawGroupRule } = api;

  // Stable identity is part of `useJumpResolver`'s contract: the debounced
  // search effect depends on this object, so a fresh literal per render would
  // re-issue the search on every render of this component.
  const searchers = useMemo(() => {
    const built: Partial<Record<OktaIdKind, (query: string) => Promise<JumpResult[]>>> = {};
    if (nav.canNavigateTo('group')) {
      built.group = async (query) =>
        (await searchGroups(query)).map((group) => ({
          kind: 'group' as const,
          id: group.id,
          name: group.name,
          secondary: group.description || undefined,
        }));
    }
    if (nav.canNavigateTo('user')) {
      built.user = async (query) =>
        (await searchUsers(query)).map((user) => ({
          kind: 'user' as const,
          id: user.id,
          name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.login,
          secondary: user.email || user.login,
        }));
    }
    return built;
  }, [nav, searchGroups, searchUsers]);

  // Needs no memoization — only ever reached from `submit`, an event handler.
  const fetchers: Partial<Record<OktaIdKind, (id: string) => Promise<JumpResult | null>>> = {
    group: async (id) => {
      const group = await getGroupById(id);
      return group
        ? {
            kind: 'group',
            id: group.id,
            name: group.name,
            secondary: group.description || undefined,
          }
        : null;
    },
    user: async (id) => {
      const user = await getUserById(id);
      return user
        ? {
            kind: 'user',
            id: user.id,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.login,
            secondary: user.email || user.login,
          }
        : null;
    },
    app: async (id) => {
      const app = await getAppById(id);
      return app ? { kind: 'app', id: app.id, name: app.label || app.name || app.id } : null;
    },
    rule: async (id) => {
      const rule = await getRawGroupRule(id);
      return rule
        ? {
            kind: 'rule',
            id: rule.id,
            name: rule.name || rule.id,
            secondary: rule.status === 'INACTIVE' ? 'Paused' : 'Active',
          }
        : null;
    },
  };

  const jump = useJumpResolver({ index, searchers, fetchers, enabled: isActive });

  const handleSelect = (result: JumpResult) => {
    nav.navigateTo({ type: navigationTarget(result.kind), id: result.id });
  };

  const handleOpenEntry = (entry: WorkingSetRef) => {
    nav.navigateTo({ type: entry.kind, id: entry.id });
  };

  return (
    <div className="tab-content active">
      <div className="w-full max-w-7xl mx-auto px-6 py-6 space-y-6">
        <JumpBar
          jump={jump}
          onSelect={handleSelect}
          canReach={(kind) => nav.canNavigateTo(navigationTarget(kind))}
          oktaOrigin={oktaOrigin}
          autoFocus={autoFocus}
        />

        <WorkingSet
          pinned={workingSet.pinned}
          recent={workingSet.recent}
          onOpen={handleOpenEntry}
          onUnpin={(entry) => workingSet.forget(entry.kind, entry.id)}
          onForget={(entry) => workingSet.forget(entry.kind, entry.id)}
        />

        <OrgSnapshotCard
          boxes={orgFigures.boxes}
          readAt={orgFigures.readAt}
          isRefreshing={orgFigures.isRefreshing}
          onRefresh={orgFigures.refresh}
          canRefresh={orgFigures.canRefresh}
          onOpenTab={onOpenTab}
          onOpenListView={onOpenListView}
        />

        <ReportsCard
          reports={reports}
          onOpenGroup={(id) => nav.navigateTo({ type: 'group', id })}
        />
      </div>
    </div>
  );
};

export default HomeTab;
