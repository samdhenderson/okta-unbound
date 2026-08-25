/**
 * @module sidepanel/components/groups/detail/AttributeHealthCard
 * @description One card in {@link module:sidepanel/components/groups/detail/GroupHealthPane}'s
 * attribute-health grid: an attribute at least one of the group's feeding rules
 * depends on.
 *
 * Purely presentational — the precomputed distribution and dependent-rule list
 * both come from the caller, which intersects
 * {@link module:sidepanel/components/members/memberAnalytics.discoverAttributeBreakdowns}
 * with {@link module:shared/rules/groupAttributeIndex.indexRulesByAttribute}.
 */
import React from 'react';
import RuleLinkRow from './RuleLinkRow';
import type { AttributeSummary } from '../../members/memberAnalytics';
import type { AttributeRuleRef } from '../../../../shared/rules/groupAttributeIndex';

/** Props for {@link AttributeHealthCard}. */
export interface AttributeHealthCardProps {
  /** The attribute's precomputed distribution (blank rate, distinct value count, top values). */
  summary: AttributeSummary;
  /** The feeding rules that reference this attribute. */
  rules: AttributeRuleRef[];
  /** Deep-links a dependent rule into the Rules tab. */
  onNavigateToRule?: (ruleId: string) => void;
}

/**
 * One attribute a feeding rule depends on: its name (mono, the identifier every
 * rule condition actually keys off), a blank-rate bar, and the rule(s) that
 * reference it.
 *
 * @example
 * ```tsx
 * <AttributeHealthCard summary={summary} rules={rules} onNavigateToRule={openRule} />
 * ```
 */
const AttributeHealthCard: React.FC<AttributeHealthCardProps> = ({
  summary,
  rules,
  onNavigateToRule,
}) => (
  <div className="space-y-3 rounded-md border border-neutral-200 bg-white p-4">
    <div className="flex items-baseline justify-between gap-2">
      <code
        className="truncate font-mono text-sm font-semibold text-neutral-900"
        title={summary.label}
      >
        {summary.key}
      </code>
      <span className="shrink-0 text-xs text-neutral-500">
        {Math.round(summary.fillRate)}% populated
      </span>
    </div>
    <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
      <div className="h-full rounded-full bg-primary" style={{ width: `${summary.fillRate}%` }} />
    </div>
    <p className="text-xs text-neutral-600">
      {summary.distinct.toLocaleString()} distinct value{summary.distinct === 1 ? '' : 's'} across{' '}
      {summary.populated.toLocaleString()} of {summary.total.toLocaleString()} members.
    </p>
    <div>
      <h3 className="text-xs font-medium text-neutral-600">
        Depended on by {rules.length} rule{rules.length === 1 ? '' : 's'}
      </h3>
      <ul className="mt-1.5 space-y-1.5">
        {rules.map((rule) => (
          <li key={rule.ruleId}>
            <RuleLinkRow
              name={rule.ruleName}
              onSelect={onNavigateToRule ? () => onNavigateToRule(rule.ruleId) : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default AttributeHealthCard;
