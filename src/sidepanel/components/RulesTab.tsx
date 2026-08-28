/**
 * @module sidepanel/components/RulesTab
 * @description Rules tab shell: browse, search, filter, and manage group rules.
 *
 * A thin coordinator that owns cross-cutting shell state (search/filter, error,
 * TabState persistence, deep-link navigation) and composes the rule hooks
 * (`useRulesData` for load/cache, `useRuleLifecycle` for activate/deactivate,
 * `useRuleImpact` for the impact preview) with presentational subcomponents
 * (`RulesMetaRow`, `RulesStatsGrid`, `RulesToolbar`, `RulesListPanel`) plus the
 * `RuleImpactModal`. Deactivation is gated behind that modal (Feature B).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import RuleImpactModal from './RuleImpactModal';
import PageHeader from './shared/PageHeader';
import Button from './shared/Button';
import AlertMessage from './shared/AlertMessage';
import RulesMetaRow from './rules/RulesMetaRow';
import RulesStatsGrid from './rules/RulesStatsGrid';
import RulesToolbar, { type RulesFilterType } from './rules/RulesToolbar';
import type { RulesListView } from '../listViewRequest';
import RulesListPanel from './rules/RulesListPanel';
import RulesMergeBanner from './rules/RulesMergeBanner';
import CurrentGroupRuleRelations from './rules/CurrentGroupRuleRelations';
import RuleConsolidationModal from './RuleConsolidationModal';
import type { FormattedRule, OktaGroupRule } from '../../shared/types';
import { filterRules } from '../../shared/ruleUtils';
import { findMergeableRuleGroups, type MergeableRuleGroup } from '../../shared/rules/consolidation';
import { sortRules, type RuleSortMode } from '../../shared/rules/similarity';
import { useOktaApi } from '../hooks/useOktaApi';
import type { OperationResult } from '../hooks/useOktaApi/types';
import { useRuleImpact } from '../hooks/useRuleImpact';
import { useRulesData } from '../hooks/useRulesData';
import { useRuleLifecycle } from '../hooks/useRuleLifecycle';
import { useRuleConsolidation } from '../hooks/useRuleConsolidation';
import { useReducedMotion } from '../hooks/useReducedMotion';
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
  /** Rule id to scroll to and highlight when navigated here from another tab. */
  selectedRuleId?: string | null;
  /** Called once the highlighted rule has been shown, so the parent can clear it. */
  onRuleSelected?: () => void;
  /** Deep-link to a group in the Groups tab (from a rule's target groups, B → A2). */
  onNavigateToGroup?: (groupId: string) => void;
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
  listView,
  onListViewConsumed,
  isActive = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<RulesFilterType>('all');
  const [sortMode, setSortMode] = useState<RuleSortMode>('default');
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

  const reducedMotion = useReducedMotion();

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

  // Scroll to and highlight the active rule (cross-tab deep-link or a local focus)
  // once it is in the DOM. If it is loaded but hidden by the current search/filter,
  // relax them first so a persisted filter can't swallow the deep-link.
  useEffect(() => {
    if (!activeRuleId || rules.length === 0) return;
    if (!rules.some((r) => r.id === activeRuleId)) return; // not loaded yet; loader effect handles it
    if (!filteredRules.some((r) => r.id === activeRuleId)) {
      // Target exists but is filtered out — clear the view so it renders, then
      // this effect re-runs and scrolls to it.
      setSearchQuery('');
      setActiveFilter('all');
      return;
    }
    log.debug('Navigating to rule:', activeRuleId);
    const ruleElement = document.querySelector(`[data-rule-id="${activeRuleId}"]`);
    if (ruleElement) {
      ruleElement.scrollIntoView?.({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
      const t = setTimeout(() => {
        onRuleSelected?.();
        setFocusRuleId(null);
      }, 2000);
      return () => clearTimeout(t);
    } else {
      log.warn('Rule not found in DOM:', activeRuleId);
    }
  }, [activeRuleId, rules, filteredRules, onRuleSelected, reducedMotion]);

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="Group Rules"
        subtitle="Analyze group rules and detect potential conflicts"
        badge={
          stats.conflicts > 0
            ? { text: `${stats.conflicts} Conflicts`, variant: 'warning' }
            : undefined
        }
        actions={
          <Button
            variant={rules.length > 0 ? 'secondary' : 'primary'}
            icon="refresh"
            onClick={() => loadRules(rules.length > 0)}
            disabled={data.isLoading}
            loading={data.isLoading}
          >
            {rules.length > 0 ? 'Refresh' : 'Load Rules'}
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-(--sp-gutter) py-(--sp-gutter) space-y-(--sp-rung)">
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

        {rules.length > 0 && <RulesStatsGrid stats={stats} />}

        {rules.length > 0 && (
          <RulesMergeBanner
            clusters={mergeableClusters}
            onMerge={handleMergeCluster}
            onFocusRule={setFocusRuleId}
          />
        )}

        {rules.length > 0 && (
          <CurrentGroupRuleRelations
            rules={rules}
            currentGroupId={currentGroupId}
            onFocusRule={setFocusRuleId}
          />
        )}

        {rules.length > 0 && (
          <RulesToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            conflictsCount={stats.conflicts}
            showCurrentGroup={Boolean(currentGroupId)}
            sortMode={sortMode}
            onSortChange={setSortMode}
          />
        )}

        <RulesListPanel
          isLoading={data.isLoading}
          hasRules={rules.length > 0}
          filteredRules={filteredRules}
          onLoad={() => loadRules(false)}
          onActivate={lifecycle.activateRule}
          onDeactivate={handleRequestDeactivate}
          onPreviewImpact={handlePreviewImpact}
          onAddTargetGroup={consolidation.openAddTarget}
          oktaOrigin={oktaOrigin}
          selectedRuleId={activeRuleId}
        />
      </div>

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
