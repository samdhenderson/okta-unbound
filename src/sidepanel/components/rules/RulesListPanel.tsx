/**
 * @module sidepanel/components/rules/RulesListPanel
 * @description The Rules tab's list region: loading, empty, and populated states.
 *
 * Wraps a {@link ScrollableList} of {@link RuleCard}s (each wrapped in a
 * `data-rule-id` anchor for deep-link scrolling) and picks the right empty state:
 * "no rules loaded" vs. "nothing matches the search/filter". The populated list is
 * staggered in via `.rise-in-stagger`, the same reveal `AppsListPanel` uses.
 *
 * Loading stays the `ScrollableList` spinner (`loadingMessage`) rather than a
 * `Skeleton`: rule cards are variable-height and the list's shape (how many rows,
 * how tall each is) isn't known ahead of a load, so there is no honest placeholder
 * to draw.
 */
import React from 'react';
import { useStaggerReveal } from '../../hooks/useStaggerReveal';
import RuleCard from '../RuleCard';
import EmptyState from '../shared/EmptyState';
import ScrollableList from '../shared/ScrollableList';
import type { FormattedRule } from '../../../shared/types';

interface RulesListPanelProps {
  /** Whether a load is in flight. */
  isLoading: boolean;
  /** Whether any rules are loaded at all (drives the "load" vs "no match" empty state). */
  hasRules: boolean;
  /** Rules after search + filter. */
  filteredRules: FormattedRule[];
  /** Load rules (used by the empty-state action). */
  onLoad: () => void;
  /** Activate an inactive rule. */
  onActivate: (ruleId: string) => void;
  /** Request deactivation (gated behind the impact confirm upstream). */
  onDeactivate: (ruleId: string) => void;
  /** Open the read-only impact preview for a rule. */
  onPreviewImpact: (rule: FormattedRule) => void;
  /** Start the "add target group" consolidation for a rule (A4). */
  onAddTargetGroup: (rule: FormattedRule) => void;
  /** Okta origin for each card's "View in Okta" link. */
  oktaOrigin?: string | null;
  /** Rule id to highlight/scroll to (deep-link target). */
  selectedRuleId?: string | null;
}

/** Renders the loading / empty / populated states of the rules list. */
const RulesListPanel: React.FC<RulesListPanelProps> = ({
  isLoading,
  hasRules,
  filteredRules,
  onLoad,
  onActivate,
  onDeactivate,
  onPreviewImpact,
  onAddTargetGroup,
  oktaOrigin,
  selectedRuleId,
}) => {
  const setStaggerRef = useStaggerReveal();

  return (
    <div className="min-h-[400px]">
      <ScrollableList
        loading={isLoading}
        loadingMessage={selectedRuleId ? 'Loading requested rule…' : 'Loading rules...'}
        fillAvailable={false}
        testId="rules-list"
        emptyState={
          !hasRules ? (
            <EmptyState
              icon="list"
              title="No Rules Loaded"
              description='Click "Load Rules" to analyze your Okta group rules'
              actions={[{ label: 'Load Rules', onClick: onLoad, variant: 'primary' }]}
            />
          ) : (
            <EmptyState
              icon="search"
              title="No Matching Rules"
              description="No rules match your search or filter criteria"
            />
          )
        }
      >
        {filteredRules.length > 0 && (
          <div ref={setStaggerRef} className="space-y-3 rise-in-stagger">
            {filteredRules.map((rule) => (
              <div key={rule.id} data-rule-id={rule.id}>
                <RuleCard
                  rule={rule}
                  onActivate={onActivate}
                  onDeactivate={onDeactivate}
                  onPreviewImpact={onPreviewImpact}
                  onAddTargetGroup={onAddTargetGroup}
                  oktaOrigin={oktaOrigin}
                  isHighlighted={selectedRuleId === rule.id}
                />
              </div>
            ))}
          </div>
        )}
      </ScrollableList>
    </div>
  );
};

export default RulesListPanel;
