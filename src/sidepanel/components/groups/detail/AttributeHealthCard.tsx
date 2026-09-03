/**
 * @module sidepanel/components/groups/detail/AttributeHealthCard
 * @description One card in the Insights tab's attribute grid: how one profile
 * attribute is actually populated across this group's members.
 *
 * Purely presentational — the precomputed distribution and the dependent-rule
 * list both come from the caller
 * ({@link module:sidepanel/components/members/memberAnalytics.discoverAttributeBreakdowns}
 * and {@link module:shared/rules/groupAttributeIndex.indexRulesByAttribute}).
 *
 * ## Rules are an annotation, not the filter
 *
 * A card used to exist only for attributes a feeding rule referenced. That hid
 * the drift worth catching most: a `department` nobody's rule reads, spelled four
 * different ways, is invisible until the day someone writes a rule against it.
 * Every discovered attribute gets a card now, and `rules` merely says whether
 * this one is currently load-bearing — an empty list is a real answer, so the
 * "Depended on by" block is omitted rather than rendered as "0 rules".
 *
 * ## Outliers are marked, never corrected
 *
 * The value list marks what {@link outlierValues} judges to be drift from a
 * dominant house style. It is a flag on a card, not an assertion that the record
 * is wrong — the rule is deliberately conservative (see that function), and the
 * dominant value is shown alongside so a reader can see what it diverges *from*.
 *
 * ## The "Other" row is reachable, or it is not offered
 *
 * `discoverAttributeBreakdowns` keeps the top values and folds the rest into a
 * single `Other (N values)` row. Those N values are the ones most likely to *be*
 * the drift, so the row is a text button that asks the caller to reveal them —
 * following the same "clickable only when wired" contract `BreakdownReport`
 * already uses. Without `onShowOther` it stays inert text rather than a dead
 * affordance.
 */
import React from 'react';
import RuleLinkRow from './RuleLinkRow';
import { Badge } from '../../shared';
import { outlierValues, OTHER_VALUE, type AttributeSummary } from '../../members/memberAnalytics';
import type { AttributeRuleRef } from '../../../../shared/rules/groupAttributeIndex';

/** Props for {@link AttributeHealthCard}. */
export interface AttributeHealthCardProps {
  /** The attribute's precomputed distribution (blank rate, distinct value count, top values). */
  summary: AttributeSummary;
  /**
   * The feeding rules that reference this attribute. **Empty is an answer** — no
   * rule currently depends on it — and renders as no block rather than "0 rules".
   */
  rules: AttributeRuleRef[];
  /** Deep-links a dependent rule into the Rules tab. */
  onNavigateToRule?: (ruleId: string) => void;
  /**
   * Reveals the values folded into the aggregated `Other (N values)` row. Omit
   * and that row renders as inert text — the row is only made interactive when
   * something is actually wired to answer it.
   */
  onShowOther?: () => void;
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
  onShowOther,
}) => {
  const outliers = new Set(outlierValues(summary));
  const values = summary.rows.filter((row) => row.count > 0);

  return (
    <div className="space-y-3 rounded-md border border-neutral-200 bg-white p-(--sp-card)">
      <div className="flex items-baseline justify-between gap-2">
        <code
          className="truncate font-mono text-sm font-semibold text-neutral-900"
          title={summary.label}
        >
          {summary.key}
        </code>
        <span className="flex shrink-0 items-center gap-1.5">
          {outliers.size > 0 && (
            <Badge
              variant="warning"
              title="Some members' values diverge from the dominant one — a likely spelling or casing drift, not a verdict."
            >
              {outliers.size} outlier{outliers.size === 1 ? '' : 's'}
            </Badge>
          )}
          <span className="text-xs text-neutral-500">
            {Math.round(summary.fillRate)}% populated
          </span>
        </span>
      </div>
      <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-primary" style={{ width: `${summary.fillRate}%` }} />
      </div>
      <p className="text-xs text-neutral-600">
        {summary.distinct.toLocaleString()} distinct value{summary.distinct === 1 ? '' : 's'} across{' '}
        {summary.populated.toLocaleString()} of {summary.total.toLocaleString()} members.
      </p>
      {values.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-neutral-600">Values</h3>
          <ul className="mt-1.5 space-y-1">
            {values.map((row) => {
              const isOther = row.value === OTHER_VALUE;
              const label = (
                <span
                  className={`min-w-0 truncate font-mono ${
                    outliers.has(row.value) ? 'text-warning-text' : 'text-neutral-700'
                  }`}
                  title={outliers.has(row.value) ? 'Diverges from the dominant value' : undefined}
                >
                  {outliers.has(row.value) && (
                    /* The marker is text, not colour alone: colour is not an
                     accessible signal on its own, and this list is read as much
                     as it is scanned. */
                    <span className="me-1 font-sans font-medium">Outlier:</span>
                  )}
                  {row.label}
                </span>
              );

              return (
                <li key={row.value} className="flex items-baseline justify-between gap-2 text-xs">
                  {isOther && onShowOther ? (
                    /* Raw <button> (§3 exception): the chromeless "View" text-link
                     idiom `AttributeFacet` already carries, awaiting the shared
                     `TextLink` primitive. `Button`'s padded CTA chrome would break
                     the baseline-aligned value row it sits in. */
                    <button
                      type="button"
                      onClick={onShowOther}
                      className="flex min-w-0 items-baseline gap-1.5 text-left hover:underline focus:outline-2 focus:outline-offset-2 focus:outline-primary"
                    >
                      {label}
                      <span className="shrink-0 font-medium text-primary-text">View</span>
                    </button>
                  ) : (
                    label
                  )}
                  <span className="shrink-0 tabular-nums text-neutral-500">
                    {row.count.toLocaleString()} ({Math.round(row.pct)}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Empty is an answer: no rule depends on this attribute today. Saying "0
        rules" would read as a defect rather than as a fact about coupling. */}
      {rules.length > 0 && (
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
      )}
    </div>
  );
};

export default AttributeHealthCard;
