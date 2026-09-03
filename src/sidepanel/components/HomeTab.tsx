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
 * {@link module:sidepanel/hooks/useOrgEntityIndex}, which Home reads through the
 * shell's {@link module:sidepanel/contexts/OrgEntityIndexContext} rather than
 * mounting itself — the palette reads the same one (`I-033`).
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
 * that the snapshot looked stale would double it. The card's third row is the
 * exception that proves it: MFA coverage cannot be joined from disk, so it ships
 * as a chooser over the same rows and hands the request off to the group's own
 * page rather than spending one here.
 *
 * ## No `PageHeader`
 *
 * Deliberate, per the design: a header on Home could only say "Home". The jump
 * bar is the first thing in the scroller. `TabPanel` already supplies
 * `data-header-scope` and the app scroller already carries
 * `[overflow-anchor:none]`, so the shell contract needs nothing from here.
 *
 * ## The card stack arrives together
 *
 * The four regions below — the jump bar, the working set, the org card, the
 * reports card — are one `.rise-in-stagger` group driven by
 * {@link module:sidepanel/hooks/useStaggerReveal}, not four independent
 * entrances. Without it each card pops in on its own mount, which reads as the
 * tab arriving piecemeal rather than as one surface; the hook coalesces them
 * onto a single `--dur-travel` budget so the stack cascades once, in order.
 *
 * ## Spacing is roles, not steps
 *
 * The root padding and the gap between cards consume `--sp-gutter` and
 * `--sp-rung` (ADR-0048) rather than a hand-copied `px-6 py-6 space-y-6` — the
 * same recipe seven other tab roots independently arrived at. The two roles
 * both resolve to the panel's measured width, so the stack sits tighter at
 * 360px and roomier at 720px with no prop threaded down.
 */
import React, { useState } from 'react';
import JumpBar from './home/JumpBar';
import WorkingSet from './home/WorkingSet';
import OrgSnapshotCard from './home/OrgSnapshotCard';
import ReportsCard from './home/ReportsCard';
import { useOktaApi } from '../hooks/useOktaApi';
import { useWorkingSet } from '../hooks/useWorkingSet';
import { useOrgFigures } from '../hooks/useOrgFigures';
import { useHomeReports } from '../hooks/useHomeReports';
import { useJumpResolver, type JumpResult } from '../hooks/useJumpResolver';
import { useEntitySearchSources } from '../hooks/useEntitySearchSources';
import { useStaggerReveal } from '../hooks/useStaggerReveal';
import { useEntityNavigation } from '../contexts/NavigationContext';
import { useOrgEntityIndex } from '../contexts/OrgEntityIndexContext';
import { navigationTarget } from './home/jumpDestinations';
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
  /**
   * Open a group's Insights pane with its MFA-coverage scan armed and un-run —
   * where the reports card's launcher sends a chosen group.
   *
   * A prop rather than a `navigateTo` call, deliberately: the navigation context
   * addresses *entities*, and which pane of a group's detail view a push lands
   * on is not a property of the group. `App.tsx` owns that route the same way it
   * owns {@link HomeTabProps.onOpenListView}'s.
   */
  onScanGroupMfa: (groupId: string) => void;
}

/**
 * Render the Home tab.
 *
 * @param props - See {@link HomeTabProps}.
 */
/**
 * The kinds Home's jump bar fans out over.
 *
 * Two, not the five the ⌘K palette searches. Home is a landing surface whose bar
 * is typed into casually, and every kind added here is another endpoint queried
 * per settle. Module-level and frozen by `as const` because
 * {@link module:sidepanel/hooks/useEntitySearchSources} memoizes on this
 * reference — an inline literal would re-issue the fan-out every render.
 */
const HOME_JUMP_KINDS = ['group', 'user'] as const;

const HomeTab: React.FC<HomeTabProps> = ({
  isActive,
  targetTabId,
  oktaOrigin,
  onOpenListView,
  onOpenTab,
  onScanGroupMfa,
}) => {
  const api = useOktaApi({ targetTabId, oktaOrigin });
  const nav = useEntityNavigation();

  // The shell's one mount, read here rather than opened here (`I-033`): the
  // provider gates the sync on Home being on screen, so `isActive` still
  // decides whether this tab drives org traffic (ADR-0018).
  const index = useOrgEntityIndex();
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
  const { reports, groupChoices, groupChoicesStatus } = useHomeReports({ index });

  // Captured once, at mount. React applies `autoFocus` on mount only, and the
  // tab is never unmounted, so this cannot re-steal focus from the rail button
  // on a later return to Home. Gated on visibility because a panel that is
  // open-but-hidden must not pull focus when it is eventually shown.
  const [autoFocus] = useState(() => isActive && document.visibilityState === 'visible');

  // Home searches exactly two kinds. Module-level so the `searchers` memo in
  // `useEntitySearchSources` holds — an inline literal here would re-issue the
  // fan-out on every render of this tab.
  const { searchers, fetchers } = useEntitySearchSources({ api, index, kinds: HOME_JUMP_KINDS });

  const jump = useJumpResolver({ index, searchers, fetchers, enabled: isActive });

  // Holds the four cards until the stack scrolls into view, then cascades them
  // on one `--dur-travel` budget rather than letting each pop in on its own
  // mount — see the module header's "The card stack arrives together".
  const setStaggerRef = useStaggerReveal();

  const handleSelect = (result: JumpResult) => {
    nav.navigateTo({ type: navigationTarget(result.kind), id: result.id });
  };

  const handleOpenEntry = (entry: WorkingSetRef) => {
    nav.navigateTo({ type: entry.kind, id: entry.id });
  };

  return (
    <div className="tab-content active">
      <div
        ref={setStaggerRef}
        data-testid="home-card-stack"
        className="w-full max-w-7xl mx-auto px-(--sp-gutter) py-(--sp-gutter) space-y-(--sp-rung) rise-in-stagger"
      >
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
          groupChoices={groupChoices}
          groupChoicesStatus={groupChoicesStatus}
          onScanGroupMfa={onScanGroupMfa}
        />
      </div>
    </div>
  );
};

export default HomeTab;
