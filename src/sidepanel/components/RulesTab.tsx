/**
 * @module sidepanel/components/RulesTab
 * @description Rules tab shell: browse, search, filter, and manage group rules.
 *
 * A thin coordinator that owns cross-cutting shell state (search/filter, panel
 * disclosure, error, TabState persistence, deep-link navigation) and composes the rule
 * hooks (`useRulesData` for load/cache, `useRuleLifecycle` for activate/deactivate,
 * `useRuleImpact` for the impact preview) with presentational subcomponents
 * (`RulesListActionBar`, `RulesSearchRow`, `RulesFilterPanel`, `RulesMetaRow`,
 * `RulesStatsGrid`, `RulesListPanel`) plus the `RuleImpactModal`. Deactivation is gated
 * behind that modal (Feature B).
 *
 * ## The rung's shape (ADR-0051, ADR-0059)
 *
 * The strip is **first, and a direct child of the scrolling rung box**. That is
 * load-bearing rather than tidy: a `sticky` element only travels within its own parent's
 * box, and ADR-0051 §5 records the Groups strip measuring un-stuck at `y = -183` when it
 * was nested one wrapper deeper. Everything the strip discloses renders after it.
 *
 * Three cards that used to sit permanently between the header and the first rule — the
 * stats grid, the duplicate-condition banner and the current-group relations section —
 * are now panels behind the strip's **More**, at most one open at a time. Each panel is
 * rendered only while its own verb still has an object, so a panel cannot be left open
 * over a subject that has gone (a refresh that resolves the last duplicate cluster closes
 * the duplicates panel rather than leaving an empty card with no way back to it).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import RuleImpactModal from './RuleImpactModal';
import PageHeader from './shared/PageHeader';
import Breadcrumbs from './shared/Breadcrumbs';
import EntityIdentity from './shared/EntityIdentity';
import AlertMessage from './shared/AlertMessage';
import RulesMetaRow from './rules/RulesMetaRow';
import RulesStatsGrid from './rules/RulesStatsGrid';
import RulesFilterPanel, {
  countActiveRuleFilters,
  type RulesFilterType,
} from './rules/RulesFilterPanel';
import RulesSearchRow from './rules/RulesSearchRow';
import RulesListActionBar, { type RulesPanel } from './rules/RulesListActionBar';
import RuleDetailView from './rules/RuleDetailView';
import { ruleIdentity } from './rules/ruleIdentity';
import type { RulesListView } from '../listViewRequest';
import RulesListPanel from './rules/RulesListPanel';
import RulesDuplicatesPanel from './rules/RulesDuplicatesPanel';
import CurrentGroupRuleRelations from './rules/CurrentGroupRuleRelations';
import RuleConsolidationModal from './RuleConsolidationModal';
import type { FormattedRule, OktaGroupRule } from '../../shared/types';
import { filterRules } from '../../shared/ruleUtils';
import { findMergeableRuleGroups, type MergeableRuleGroup } from '../../shared/rules/consolidation';
import { sortRules, type RuleSortMode } from '../../shared/rules/similarity';
import { countCurrentGroupRuleRelations } from '../../shared/rules/currentGroupRelations';
import { useOktaApi } from '../hooks/useOktaApi';
import type { OperationResult } from '../hooks/useOktaApi/types';
import { useRuleImpact } from '../hooks/useRuleImpact';
import { useRulesData } from '../hooks/useRulesData';
import { useRuleLifecycle } from '../hooks/useRuleLifecycle';
import { useRuleConsolidation } from '../hooks/useRuleConsolidation';
import { useViewStack } from '../hooks/useViewStack';
import { useScrollPreservation } from '../hooks/useScrollPreservation';
import type { RuleImpactInput } from '../hooks/useOktaApi/ruleImpact';
import { TabStateManager, saveRulesTabState } from '../../shared/tabState/tabStateManager';
import type { RulesTabState } from '../../shared/tabState/types';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('RulesTab');

/**
 * Does this rule assign users into the given group?
 *
 * Derived from the rule's own target `groupIds` rather than read off its
 * `affectsCurrentGroup` flag. That flag is only meaningful on a fresh,
 * group-scoped fetch: the org-wide `RulesCache` is deliberately formatted
 * *without* a current group (baking one group's flag into a shared entry would
 * be wrong — see `useOktaApi/groupDiscovery.ts`), and persisted TabState freezes
 * whatever flag was current when it was written. Deriving here is correct on
 * every path.
 *
 * @param rule - The rule to test.
 * @param groupId - The current group id, if one is detected.
 * @returns `true` when a group is detected and the rule targets it.
 */
const targetsGroup = (rule: FormattedRule, groupId?: string): boolean =>
  groupId ? rule.groupIds.includes(groupId) : false;

interface RulesTabProps {
  /** Chrome tab id of the connected Okta tab; required to fetch or mutate rules. */
  targetTabId?: number;
  /** Id of the currently detected group; enables the "Current Group" filter. */
  currentGroupId?: string;
  /** Okta org origin passed to each {@link RuleCard} for its "View in Okta" link. */
  oktaOrigin?: string | null;
  /** Rule id to open the detail rung for when navigated here from another tab. */
  selectedRuleId?: string | null;
  /** Called once the requested rule has been shown, so the parent can clear it. */
  onRuleSelected?: () => void;
  /** Deep-link to a group in the Groups tab (from a rule's target groups, B → A2). */
  onNavigateToGroup?: (groupId: string) => void;
  /**
   * Open the Export tab on the whole-org Group Rules descriptor. Absent → the strip omits
   * the verb entirely rather than shipping it disabled (ADR-0039 §3).
   */
  onExportRules?: () => void;
  /**
   * A pre-filtered view requested from another tab (the Home card's "N paused").
   * Applied once on arrival, then cleared via
   * {@link RulesTabProps.onListViewConsumed}.
   */
  listView?: RulesListView | null;
  /** Invoked once {@link RulesTabProps.listView} has been applied. */
  onListViewConsumed?: () => void;
  /**
   * Whether this is the selected top-level tab. The tab stays mounted while hidden
   * (ADR-0018), so anything that should mean "on arrival" rather than "on mount"
   * keys off this — currently the `markTabVisited` record. Scroll is **not** this
   * component's concern: the offset lives on the shared app-root scroller and is
   * preserved per tab by {@link sidepanel/components/TabPanel}. Defaults to `true`.
   */
  isActive?: boolean;
  /**
   * The app's one scroller. Handed down so the list rung's offset can be captured before
   * a push and restored on pop — the detail rung is shorter than the list, so the shared
   * scroller clamps rather than remembering (ADR-0051's consequence note on `GroupsTab`).
   */
  scrollRootRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Renders the Rules tab, orchestrating the rule data/lifecycle/impact hooks and
 * their presentational panels, plus search/filter state and TabState persistence.
 */
const RulesTab: React.FC<RulesTabProps> = ({
  targetTabId,
  currentGroupId,
  oktaOrigin,
  selectedRuleId,
  onRuleSelected,
  onNavigateToGroup,
  onExportRules,
  listView,
  onListViewConsumed,
  isActive = true,
  scrollRootRef,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<RulesFilterType>('all');
  const [sortMode, setSortMode] = useState<RuleSortMode>('default');
  // Which analysis panel the strip has open, and whether the filter panel under the
  // search field is disclosed. Both are properties of the strip you are looking at
  // rather than of the rules, so neither is persisted into TabState.
  const [activePanel, setActivePanel] = useState<RulesPanel>('none');
  const [showFilters, setShowFilters] = useState(false);
  // The rule strip's disclosure tier, and its one armed confirm. Both are properties of
  // the strip you are looking at rather than of the rule, so they reset on a rung change
  // (see the adjust-during-render block below) and neither is persisted.
  const [tierOpen, setTierOpen] = useState(false);
  const [isConfirmingActivate, setIsConfirmingActivate] = useState(false);
  // Set once the mount-time persisted-state restore has run, so the deep-link
  // auto-load doesn't race a fetch ahead of the hydrate, and a scope request
  // applies *after* (and thus wins over) any restored filter.
  const [restoreAttempted, setRestoreAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local "scroll to this rule" focus (e.g. from the merge banner's View link),
  // combined with the cross-tab deep-link so both drive one highlight path.
  const [focusRuleId, setFocusRuleId] = useState<string | null>(null);
  const activeRuleId = selectedRuleId ?? focusRuleId;

  // Single error channel; '' clears it. Stable so the hooks below keep their
  // memoized identities (useOktaApi in particular memoizes on this callback).
  const handleError = useCallback((message: string) => setError(message || null), []);

  // `onResult` takes one `OperationResult` object, not `(message, type)`. It used to
  // be positional, and TypeScript accepts a function that ignores trailing
  // parameters — so a one-arg `(message) => …` type-checked here and then silently
  // dropped `type`, rendering an 'info' message as a danger banner. That was live:
  // `captureRuleImpact` reuses `getAllGroupMembers`, which emits 'info' pagination
  // lines for any multi-page group. The object parameter makes that a compile error.
  //
  // Must be stable: useOktaApi memoizes its operations on this callback's identity.
  const handleResult = useCallback(({ message, type }: OperationResult) => {
    if (type === 'error') setError(message || null);
  }, []);

  // `oktaOrigin` lets `captureRuleImpact` read the org snapshot's rules instead
  // of re-paginating `/api/v1/groups/rules` (D-029a).
  const api = useOktaApi({
    targetTabId: targetTabId ?? null,
    oktaOrigin,
    onResult: handleResult,
  });
  const impact = useRuleImpact(api.captureRuleImpact);
  const data = useRulesData({ targetTabId, onError: handleError, currentGroupId, oktaOrigin });
  const { rules, stats, loadRules } = data;
  const lifecycle = useRuleLifecycle({
    targetTabId,
    rules,
    reload: loadRules,
    onError: handleError,
  });
  // Consolidation genuinely changes the rule set, so it force-refreshes (bypass cache).
  const consolidation = useRuleConsolidation({
    targetTabId,
    reload: () => loadRules(true),
    onError: handleError,
  });

  // Detect rules that share an identical condition (mergeable). FormattedRule
  // carries the expression + target groups the detector needs.
  const mergeableClusters = React.useMemo<MergeableRuleGroup[]>(
    () =>
      findMergeableRuleGroups(
        rules.map(
          (r) =>
            ({
              id: r.id,
              name: r.name,
              status: r.status,
              type: 'group_rule',
              created: r.created,
              lastUpdated: r.lastUpdated,
              conditions: { expression: { value: r.conditionExpression || '', type: '' } },
              actions: { assignUserToGroups: { groupIds: r.groupIds } },
            }) as OktaGroupRule,
        ),
      ),
    [rules],
  );

  const handleMergeCluster = (cluster: MergeableRuleGroup) => {
    consolidation.openMerge(
      cluster.rules[0].id,
      cluster.rules.map((r) => ({ id: r.id, name: r.name, status: r.status })),
      cluster.unionGroupIds,
    );
  };

  // Restore persisted rules + UI state on mount.
  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const savedState = await TabStateManager.loadTabState<RulesTabState>('rules');
        if (savedState) {
          log.debug('Loaded persisted state from TabStateManager');
          data.hydrate({
            rules: savedState.cachedRules,
            stats: savedState.cachedStats,
            lastFetchTime: savedState.lastFetchTime,
          });
          if (savedState.searchQuery) setSearchQuery(savedState.searchQuery);
          if (savedState.activeFilter) setActiveFilter(savedState.activeFilter);
          if (savedState.sortMode) setSortMode(savedState.sortMode);
        }
      } catch (err) {
        log.error('Failed to load persisted state:', err);
      } finally {
        setRestoreAttempted(true);
      }
    };

    loadPersistedState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record the visit on every arrival, not just the first: the tab is mounted
  // once and then hidden/shown, so a mount-only call would only ever see the
  // first visit of a panel session.
  useEffect(() => {
    if (isActive) void TabStateManager.markTabVisited('rules');
  }, [isActive]);

  // A pre-filtered view requested from the Home card. It waits for the
  // persisted-state restore, so it lands *after* (and beats) any filter the last
  // session left behind — otherwise arriving on "Paused" would depend on what
  // the restore happened to write first.
  //
  // The search box is cleared too: a stale query would silently subtract from
  // the count the card just showed, and a filter that disagrees with the figure
  // that opened it is worse than no link.
  const listViewHandledRef = useRef<RulesListView | null>(null);
  useEffect(() => {
    if (!listView) {
      listViewHandledRef.current = null;
      return;
    }
    if (!restoreAttempted || listViewHandledRef.current === listView) return;
    listViewHandledRef.current = listView;
    setSearchQuery('');
    setActiveFilter(listView);
    onListViewConsumed?.();
  }, [listView, restoreAttempted, onListViewConsumed]);

  // Rules load manually, not on mount, so a view request can arrive against an
  // empty list. Same load-on-demand the rule deep-link below does.
  const listViewLoadRef = useRef<RulesListView | null>(null);
  useEffect(() => {
    if (!listView) {
      listViewLoadRef.current = null;
      return;
    }
    if (
      restoreAttempted &&
      rules.length === 0 &&
      !data.isLoading &&
      targetTabId != null &&
      listViewLoadRef.current !== listView
    ) {
      listViewLoadRef.current = listView;
      void loadRules(false);
    }
  }, [listView, restoreAttempted, rules.length, data.isLoading, targetTabId, loadRules]);

  // A cross-tab deep-link can arrive before rules have ever been loaded this
  // session (rules load manually, not on mount). Kick a cache-first load once so
  // the target can actually render — mirroring the Users tab's load-on-demand.
  const deepLinkLoadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeRuleId) {
      deepLinkLoadRef.current = null;
      return;
    }
    if (
      restoreAttempted &&
      rules.length === 0 &&
      !data.isLoading &&
      targetTabId != null &&
      deepLinkLoadRef.current !== activeRuleId
    ) {
      deepLinkLoadRef.current = activeRuleId;
      void loadRules(false);
    }
  }, [activeRuleId, restoreAttempted, rules.length, data.isLoading, targetTabId, loadRules]);

  // Persist rules + UI state whenever they change.
  useEffect(() => {
    if (rules.length > 0) {
      saveRulesTabState({
        cachedRules: rules,
        cachedStats: stats,
        lastFetchTime: data.lastFetchTime,
        searchQuery,
        activeFilter,
        sortMode,
      }).catch((err) => log.error('Failed to persist state:', err));
    }
  }, [rules, stats, data.lastFetchTime, searchQuery, activeFilter, sortMode]);

  /** Build the minimal rule shape the impact preview needs. */
  const toRuleImpactInput = (rule: FormattedRule): RuleImpactInput => ({
    id: rule.id,
    name: rule.name,
    groupIds: rule.groupIds,
    groupNames: rule.groupNames,
  });

  const handlePreviewImpact = (rule: FormattedRule) =>
    impact.open(toRuleImpactInput(rule), 'preview');

  /** Gate deactivation behind the impact preview; commit only after confirm. */
  const handleRequestDeactivate = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) impact.open(toRuleImpactInput(rule), 'deactivate');
  };

  const handleConfirmDeactivate = () => {
    const ruleId = impact.rule?.id;
    impact.close();
    if (ruleId) void lifecycle.deactivateRule(ruleId);
  };

  /*
    Activation is gated now, and it was not before — the rule card fired
    `lifecycle.activateRule` straight from a click. The gate is not symmetry with
    deactivate; it is the *asymmetry*. Okta's rule engine only ever adds, so activating
    writes memberships into every target group and pausing the rule again removes none of
    them (D-052). That is a change with no second press to take it back, which is exactly
    what ADR-0039 puts behind a confirm.

    Deactivation keeps `RuleImpactModal` as its confirm rather than gaining one of these:
    a dialog that names who is affected beats a sentence describing it.
  */
  const handleConfirmActivate = () => {
    const ruleId = openRule?.id;
    setIsConfirmingActivate(false);
    if (ruleId) void lifecycle.activateRule(ruleId);
  };

  // Re-derive each rule's current-group relation before anything reads it. This
  // tab is the only place that knows the detected group, so it stamps the truth
  // onto the rules it hands down (RuleCard's "Current Group" badge and border
  // read the same field) instead of trusting a flag baked at cache-write time.
  const scopedRules = React.useMemo(
    () =>
      rules.map((r) => {
        const affectsCurrentGroup = targetsGroup(r, currentGroupId);
        return Boolean(r.affectsCurrentGroup) === affectsCurrentGroup
          ? r
          : { ...r, affectsCurrentGroup };
      }),
    [rules, currentGroupId],
  );

  // Apply search, the active filter chip, then the chosen sort order (which can
  // pair up similar rules so near-duplicates sit next to each other for review).
  const filteredRules = React.useMemo(() => {
    let result = filterRules(scopedRules, searchQuery);
    switch (activeFilter) {
      case 'active':
        result = result.filter((r) => r.status === 'ACTIVE');
        break;
      // A paused rule is a rule that has stopped maintaining its groups. Nothing
      // in Okta says when it was paused or by whom, so the list is the finding.
      case 'paused':
        result = result.filter((r) => r.status === 'INACTIVE');
        break;
      case 'conflicts':
        result = result.filter((r) => r.conflicts && r.conflicts.length > 0);
        break;
      case 'current-group':
        result = result.filter((r) => targetsGroup(r, currentGroupId));
        break;
    }
    return sortRules(result, sortMode);
  }, [scopedRules, searchQuery, activeFilter, sortMode, currentGroupId]);

  // The count on the strip's *This group* verb, computed by the same helper the panel
  // itself lists with, so the label can never promise more rows than the panel shows.
  const currentGroupRelationCount = React.useMemo(
    () => countCurrentGroupRuleRelations(rules, currentGroupId),
    [rules, currentGroupId],
  );

  /*
    The rung stack. The list stays mounted and hidden behind a pushed rule (ADR-0016):
    unmounting it would throw away the progressive-reveal window, the filter state and
    the focus-restore target, and "back" would return to a reset list.
  */
  const ruleViewRef = useRef<HTMLDivElement>(null);
  const nav = useViewStack<FormattedRule>({
    rootLabel: 'Group Rules',
    getLabel: (entry) => entry.name,
    getKey: (entry) => entry.id,
    viewRef: ruleViewRef,
  });
  const { push: pushRule, pop: popRule, currentEntry } = nav;

  const captureListScroll = useScrollPreservation(scrollRootRef ?? ruleViewRef, nav.isRoot);

  /*
    Re-resolve the pushed rule against the live list rather than rendering the snapshot
    taken at push time — the `UserRungHeader` pattern. A refresh, an activate or a
    consolidation replaces the objects in `rules`, and a rung showing the pre-write copy
    would state the old status under a header that had just been told the write succeeded.
    Falls back to the pushed entry so the rung survives a rule vanishing mid-read.
  */
  const openRule = currentEntry
    ? (rules.find((r) => r.id === currentEntry.id) ?? currentEntry)
    : null;

  /*
    The header's identity, built by a pure per-entity function beside its entity
    (ADR-0032 §2). Its presence is also what every branch in the header below switches
    on — one test for "am I on the detail rung", rather than four.
  */
  const identity = openRule ? ruleIdentity(openRule) : null;

  /*
    Collapse the strip's tier and disarm any confirm whenever the rung changes. Adjusted
    during render rather than in an effect — the pattern `UsersTab` and `PageHeader` use —
    so React re-renders immediately instead of committing a frame with the previous rule's
    tier open over the new one's verbs.
  */
  const [tierRung, setTierRung] = useState<string | null>(null);
  const openRuleKey = openRule?.id ?? null;
  if (tierRung !== openRuleKey) {
    setTierRung(openRuleKey);
    setTierOpen(false);
    setIsConfirmingActivate(false);
  }

  /** Push a rule's detail rung, remembering where the list was. */
  const handleOpenRule = useCallback(
    (ruleToOpen: FormattedRule) => {
      captureListScroll();
      pushRule(ruleToOpen);
    },
    [captureListScroll, pushRule],
  );

  /** Open a panel, or close it if it is already the open one. At most one at a time. */
  const togglePanel = useCallback(
    (panel: RulesPanel) => setActivePanel((prev) => (prev === panel ? 'none' : panel)),
    [],
  );

  /*
    A requested rule — a cross-tab deep-link, or a "View" press inside one of the analysis
    panels — now **opens its rung** rather than scrolling the list to it and flashing the
    card for two seconds.

    That is a behaviour change and it is the point of this rung existing. Scroll-and-flash
    was the best a list could do: it put the reader next to a collapsed row and left them
    to expand it. It also had to fight the filters — a persisted "Active only" would hide
    an inactive target, so the effect cleared the search and the filter to make the row
    renderable. The rung does not care what the list is filtered to, so that whole dance
    goes with it, along with the 2s highlight window and the `reducedMotion` branch that
    chose its scroll behaviour.
  */
  useEffect(() => {
    if (!activeRuleId) return;
    const target = rules.find((r) => r.id === activeRuleId);
    if (!target) return; // not loaded yet; the loader effect above handles it
    if (currentEntry?.id === activeRuleId) return; // already showing it
    log.debug('Opening rule rung:', activeRuleId);
    captureListScroll();
    pushRule(target);
    onRuleSelected?.();
    setFocusRuleId(null);
  }, [activeRuleId, rules, currentEntry, captureListScroll, pushRule, onRuleSelected]);

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      {/*
        One `PageHeader` for both rungs, swapping its contents as a rule is pushed and
        popped (ADR-0016) — never a second header inside the detail view, and never a
        second identity card inside its body (ADR-0032).

        No `actions` on either rung. On the list, Load/Refresh is the page-level verb and
        it lives in the strip now, where ADR-0030 §2 says it belongs and where it is the
        `primary` this rung was missing (ADR-0059). On the detail rung there is no
        `actions` node either: `ruleIdentity` emits no `link`, because Okta has no
        per-rule route, and the honest rules-list link is stated as what it is inside the
        view rather than dressed as a deep link here.
      */}
      <PageHeader
        title={identity ? identity.name : 'Group Rules'}
        subtitle={identity ? undefined : 'Analyze group rules and detect potential conflicts'}
        onBack={identity ? popRule : undefined}
        backLabel="Back to rules"
        breadcrumbs={identity ? <Breadcrumbs items={nav.trail} /> : undefined}
        sticky={isActive}
        identityKey={identity?.key}
        identity={identity ? <EntityIdentity rows={identity.rows} /> : undefined}
        badge={
          identity
            ? identity.badge
            : stats.conflicts > 0
              ? { text: `${stats.conflicts} Conflicts`, variant: 'warning' }
              : undefined
        }
      />

      <div
        hidden={!nav.isRoot}
        className={`max-w-7xl mx-auto px-(--sp-gutter) py-(--sp-gutter) space-y-(--sp-rung) ${
          nav.transition === 'pop' ? 'animate-pop-in' : ''
        }`}
      >
        {/*
          First in the rung, and a direct child of it. `sticky` only travels inside its
          own parent's box, and the `.dock-sentinel` timeline hoists onto that same
          parent — nest this in a wrapper and the strip scrolls away instead of docking
          (ADR-0051 §5).
        */}
        <RulesListActionBar
          search={
            rules.length > 0 ? (
              <RulesSearchRow
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filtersOpen={showFilters}
                onToggleFilters={() => setShowFilters((prev) => !prev)}
                activeFilterCount={countActiveRuleFilters(activeFilter, sortMode)}
              />
            ) : undefined
          }
          hasRules={rules.length > 0}
          isLoading={data.isLoading}
          onLoad={() => loadRules(rules.length > 0)}
          duplicateClusterCount={mergeableClusters.length}
          hasCurrentGroup={Boolean(currentGroupId)}
          currentGroupRelationCount={currentGroupRelationCount}
          activePanel={activePanel}
          onTogglePanel={togglePanel}
          onExportRules={onExportRules}
        />

        {/*
          The toolbar zone: the disclosed filter panel and whichever analysis panel the
          strip has open. Each is gated on the same condition that puts its verb on the
          strip, so a panel can never outlive the control that closes it.
        */}
        {rules.length > 0 && showFilters && (
          <RulesFilterPanel
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            conflictsCount={stats.conflicts}
            showCurrentGroup={Boolean(currentGroupId)}
            sortMode={sortMode}
            onSortChange={setSortMode}
          />
        )}

        {activePanel === 'stats' && rules.length > 0 && <RulesStatsGrid stats={stats} />}

        {activePanel === 'duplicates' && mergeableClusters.length > 0 && (
          <RulesDuplicatesPanel
            clusters={mergeableClusters}
            onMerge={handleMergeCluster}
            onFocusRule={setFocusRuleId}
          />
        )}

        {activePanel === 'currentGroup' && (
          <CurrentGroupRuleRelations
            rules={rules}
            currentGroupId={currentGroupId}
            onFocusRule={setFocusRuleId}
          />
        )}

        <RulesMetaRow
          apiCost={data.apiCost}
          lastFetchTime={data.lastFetchTime}
          hasRules={rules.length > 0}
        />

        {error && (
          <AlertMessage
            message={{ text: error, type: 'danger' }}
            onDismiss={() => setError(null)}
          />
        )}

        {/* The activate/deactivate just performed was audited without an actor
            (D-013c). Informational only — the rule change already happened. */}
        {lifecycle.actorNotice && (
          <AlertMessage message={lifecycle.actorNotice} onDismiss={lifecycle.dismissActorNotice} />
        )}

        <RulesListPanel
          isLoading={data.isLoading}
          hasRules={rules.length > 0}
          filteredRules={filteredRules}
          onLoad={() => loadRules(false)}
          onOpenRule={handleOpenRule}
          selectedRuleId={activeRuleId}
        />
      </div>

      {/*
        The pushed rung, a **sibling** of the list rather than its replacement — that is
        what lets the list above keep its scroll offset, its filter and its reveal window
        while this is on screen. `tabIndex={-1}` is the focus target `useViewStack` moves
        to when nothing inside is focusable.
      */}
      {openRule && (
        <div
          ref={ruleViewRef}
          tabIndex={-1}
          className="max-w-7xl mx-auto px-(--sp-gutter) py-(--sp-gutter) animate-push-in"
        >
          <RuleDetailView
            rule={openRule}
            oktaOrigin={oktaOrigin}
            onPreviewImpact={
              openRule.groupIds.length > 0 ? () => handlePreviewImpact(openRule) : undefined
            }
            tierOpen={tierOpen}
            onTierOpenChange={setTierOpen}
            isConfirmingActivate={isConfirmingActivate}
            onRequestActivate={() => setIsConfirmingActivate(true)}
            onCancelActivate={() => setIsConfirmingActivate(false)}
            onConfirmActivate={handleConfirmActivate}
            onRequestDeactivate={() => handleRequestDeactivate(openRule.id)}
            onAddTargetGroup={() => consolidation.openAddTarget(openRule)}
            sticky={isActive}
          />
        </div>
      )}

      <RuleImpactModal
        isOpen={impact.rule !== null}
        ruleName={impact.rule?.name ?? ''}
        mode={impact.mode}
        status={impact.status}
        summary={impact.summary}
        error={impact.error}
        progress={impact.progress}
        onClose={impact.close}
        onConfirmDeactivate={handleConfirmDeactivate}
        onNavigateToGroup={
          onNavigateToGroup
            ? (groupId) => {
                impact.close();
                onNavigateToGroup(groupId);
              }
            : undefined
        }
      />

      <RuleConsolidationModal
        phase={consolidation.phase}
        preview={consolidation.preview}
        result={consolidation.result}
        error={consolidation.error}
        actorNotice={consolidation.actorNotice}
        onDismissActorNotice={consolidation.dismissActorNotice}
        searchGroups={api.searchGroups}
        onChooseGroup={consolidation.chooseGroup}
        onExecute={consolidation.execute}
        onClose={consolidation.close}
      />
    </div>
  );
};

export default RulesTab;
