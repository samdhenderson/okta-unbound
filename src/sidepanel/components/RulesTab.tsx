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
import React, { useState, useEffect, useCallback } from 'react';
import RuleImpactModal from './RuleImpactModal';
import PageHeader from './shared/PageHeader';
import Button from './shared/Button';
import AlertMessage from './shared/AlertMessage';
import RulesMetaRow from './rules/RulesMetaRow';
import RulesStatsGrid from './rules/RulesStatsGrid';
import RulesToolbar, { type RulesFilterType } from './rules/RulesToolbar';
import RulesListPanel from './rules/RulesListPanel';
import type { FormattedRule } from '../../shared/types';
import { filterRules } from '../../shared/ruleUtils';
import { useOktaApi } from '../hooks/useOktaApi';
import { useRuleImpact } from '../hooks/useRuleImpact';
import { useRulesData } from '../hooks/useRulesData';
import { useRuleLifecycle } from '../hooks/useRuleLifecycle';
import type { RuleImpactInput } from '../hooks/useOktaApi/ruleImpact';
import { TabStateManager, saveRulesTabState } from '../../shared/tabState/tabStateManager';
import type { RulesTabState } from '../../shared/tabState/types';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('RulesTab');

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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<RulesFilterType>('all');
  const [error, setError] = useState<string | null>(null);

  // Single error channel; '' clears it. Stable so the hooks below keep their
  // memoized identities (useOktaApi in particular memoizes on this callback).
  const handleError = useCallback((message: string) => setError(message || null), []);

  const api = useOktaApi({ targetTabId: targetTabId ?? null, onResult: handleError });
  const impact = useRuleImpact(api.captureRuleImpact);
  const data = useRulesData({ targetTabId, onError: handleError });
  const { rules, stats, loadRules } = data;
  const lifecycle = useRuleLifecycle({
    targetTabId,
    rules,
    reload: loadRules,
    onError: handleError,
  });

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
          if (savedState.scrollPosition) {
            setTimeout(() => window.scrollTo(0, savedState.scrollPosition), 100);
          }
        }
      } catch (err) {
        log.error('Failed to load persisted state:', err);
      }
    };

    loadPersistedState();
    TabStateManager.markTabVisited('rules');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to and highlight a deep-linked rule once it is in the DOM.
  useEffect(() => {
    if (selectedRuleId && rules.length > 0) {
      log.debug('Navigating to rule:', selectedRuleId);
      const ruleElement = document.querySelector(`[data-rule-id="${selectedRuleId}"]`);
      if (ruleElement) {
        ruleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => onRuleSelected?.(), 2000);
      } else {
        log.warn('Rule not found in DOM:', selectedRuleId);
      }
    }
  }, [selectedRuleId, rules, onRuleSelected]);

  // Persist rules + UI state whenever they change.
  useEffect(() => {
    if (rules.length > 0) {
      saveRulesTabState({
        cachedRules: rules,
        cachedStats: stats,
        lastFetchTime: data.lastFetchTime,
        searchQuery,
        activeFilter,
        scrollPosition: window.scrollY,
      }).catch((err) => log.error('Failed to persist state:', err));
    }
  }, [rules, stats, data.lastFetchTime, searchQuery, activeFilter]);

  // Persist scroll position periodically.
  useEffect(() => {
    const handleScroll = () => TabStateManager.updateScrollPosition('rules', window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Apply search and the active filter chip.
  const filteredRules = React.useMemo(() => {
    let result = filterRules(rules, searchQuery);
    switch (activeFilter) {
      case 'active':
        result = result.filter((r) => r.status === 'ACTIVE');
        break;
      case 'conflicts':
        result = result.filter((r) => r.conflicts && r.conflicts.length > 0);
        break;
      case 'current-group':
        result = result.filter((r) => r.affectsCurrentGroup);
        break;
    }
    return result;
  }, [rules, searchQuery, activeFilter]);

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

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
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

        {rules.length > 0 && <RulesStatsGrid stats={stats} />}

        {rules.length > 0 && (
          <RulesToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            conflictsCount={stats.conflicts}
            showCurrentGroup={Boolean(currentGroupId)}
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
          oktaOrigin={oktaOrigin}
          selectedRuleId={selectedRuleId}
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
      />
    </div>
  );
};

export default RulesTab;
