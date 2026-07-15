/**
 * @module sidepanel/components/rules/RulesListPanel
 * @description The Rules tab's list region: loading, empty, and populated states.
 *
 * Renders a spinner while loading, an EmptyState when no rules are loaded or none
 * match the filters, otherwise the filtered {@link RuleCard} list (each wrapped in
 * a `data-rule-id` anchor for deep-link scrolling).
 */
import React from 'react';
import RuleCard from '../RuleCard';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
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
}) => (
  <div className="min-h-[400px]">
    {isLoading ? (
      <LoadingSpinner size="lg" message="Loading rules..." centered />
    ) : !hasRules ? (
      <EmptyState
        icon="list"
        title="No Rules Loaded"
        description='Click "Load Rules" to analyze your Okta group rules'
        actions={[{ label: 'Load Rules', onClick: onLoad, variant: 'primary' }]}
      />
    ) : filteredRules.length === 0 ? (
      <EmptyState
        icon="search"
        title="No Matching Rules"
        description="No rules match your search or filter criteria"
      />
    ) : (
      <div className="space-y-3">
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
  </div>
);

export default RulesListPanel;
