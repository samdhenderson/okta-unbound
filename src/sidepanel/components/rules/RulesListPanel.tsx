/**
 * @module sidepanel/components/rules/RulesListPanel
 * @description The Rules tab's list region: loading, empty, and populated states.
 *
 * Wraps a {@link ScrollableList} of {@link RuleCard}s and picks the right empty state:
 * "no rules loaded" vs. "nothing matches the search/filter". The populated list is
 * staggered in via `.rise-in-stagger`, the same reveal `AppsListPanel` uses.
 *
 * Each card opens the rule's own rung. It used to carry four write verbs inside a
 * disclosure instead; those are the rung's `ActionBar` now (ADR-0030 §2, ADR-0039), so
 * this panel brokers one callback where it brokered four.
 *
 * Loading draws a row `Skeleton`, not a spinner. This reverses an earlier call
 * here that a rule card is "variable-height, so there is no honest placeholder to
 * draw" — that was wrong about its own component. Cards always load **collapsed**,
 * and a collapsed {@link RuleCard} is a fixed `p-4` header (status dot, title,
 * subtitle, chevron); the variable height only appears once a user expands one,
 * which cannot happen before the list exists. `variant="row" size="lg"` is that
 * header's shape.
 *
 * `Skeleton`'s `label` carries the announcement `loadingMessage` used to, as
 * visually-hidden text in a `role="status"` node, so the deep-link variant
 * ("Loading requested rule…") is still announced and still findable by `getByText`.
 */
import React from 'react';
import { useStaggerReveal } from '../../hooks/useStaggerReveal';
import RuleCard from '../RuleCard';
import EmptyState from '../shared/EmptyState';
import ScrollableList from '../shared/ScrollableList';
import Skeleton from '../shared/Skeleton';
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
  /** Open a rule's detail rung. */
  onOpenRule: (rule: FormattedRule) => void;
  /** Rule id currently being opened (deep-link target), for the arrival flash. */
  selectedRuleId?: string | null;
}

/** Renders the loading / empty / populated states of the rules list. */
const RulesListPanel: React.FC<RulesListPanelProps> = ({
  isLoading,
  hasRules,
  filteredRules,
  onLoad,
  onOpenRule,
  selectedRuleId,
}) => {
  const setStaggerRef = useStaggerReveal();

  const loadingMessage = selectedRuleId ? 'Loading requested rule…' : 'Loading rules...';

  return (
    <div className="min-h-[400px]">
      <ScrollableList
        loading={isLoading}
        loadingMessage={loadingMessage}
        skeleton={<Skeleton variant="row" size="lg" count={6} label={loadingMessage} />}
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
          <div ref={setStaggerRef} className="space-y-(--sp-rung) rise-in-stagger">
            {filteredRules.map((rule) => (
              <div key={rule.id} data-rule-id={rule.id}>
                <RuleCard
                  rule={rule}
                  onOpenRule={onOpenRule}
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
