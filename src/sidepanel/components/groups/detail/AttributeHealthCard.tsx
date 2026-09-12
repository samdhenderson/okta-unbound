/**
 * @module sidepanel/components/groups/detail/AttributeHealthCard
 * @description One card in the Insights tab's attribute grid: how one profile
 * attribute is actually populated across this group's members.
 *
 * Purely presentational — the precomputed distribution, the ranking signals and
 * the dependent-rule list all come from the caller
 * ({@link module:sidepanel/components/members/memberAnalytics.discoverAttributeBreakdowns},
 * {@link module:sidepanel/components/members/memberAnalytics.rankAttributes} and
 * {@link module:shared/rules/groupAttributeIndex.indexRulesByAttribute}).
 *
 * ## One anatomy, ranked
 *
 * Every attribute gets the **same card** — and it is the same card the MFA
 * coverage reports use, {@link module:sidepanel/components/shared/InsightCard},
 * which owns the chrome, the disclosure and the badge strip. Severity is carried
 * by *order* and by *badges*, never by giving a flagged attribute a different
 * shape.
 *
 * ## Three stages
 *
 * 1. **Collapsed** — title, signal badges, the spread bar, the value count.
 * 2. **Expanded** — the value breakdown, the blank line, the dependent rules.
 * 3. **Modal** — the full distribution, including everything folded into
 *    `Other`, via the caller's `onShowOther`.
 *
 * ## Outliers are marked, never corrected
 *
 * The value list marks what {@link outlierValues} judges to be drift from a
 * dominant house style. It is a flag on a card, not an assertion that the record
 * is wrong — the rule is deliberately conservative (see that function), and the
 * dominant value is shown alongside so a reader can see what it diverges *from*.
 * The `drift` **badge** is a different, wider claim: near-duplicate spellings
 * anywhere in the attribute, including inside the tail this card never names.
 */
import React from 'react';
import RuleLinkRow from './RuleLinkRow';
import AttributeSpreadBar from './AttributeSpreadBar';
import { spreadSegments } from './attributeSpread';
import { Badge, Button, InsightCard, type BadgeVariant } from '../../shared';
import {
  attributeTailCount,
  outlierValues,
  NONE_VALUE,
  type AttributeSignal,
  type AttributeSignalKind,
  type AttributeSummary,
} from '../../members/memberAnalytics';
import type { AttributeRuleRef } from '../../../../shared/rules/groupAttributeIndex';

/**
 * Badge treatment per signal, as a lookup map (the house variant convention).
 *
 * `drift` is the only `warning`: it is the only signal that says something is
 * *wrong*. A hidden tail is `neutral` because it is a fact about this card's own
 * truncation, and rule coupling is `primary` because it is a fact about the
 * group, not a fault.
 */
const SIGNAL_VARIANT: Record<AttributeSignalKind, BadgeVariant> = {
  drift: 'warning',
  tail: 'neutral',
  rule: 'primary',
};

/** Props for {@link AttributeHealthCard}. */
export interface AttributeHealthCardProps {
  /** The attribute's precomputed distribution (blank rate, distinct value count, top values). */
  summary: AttributeSummary;
  /**
   * Why this attribute ranks where it does, from
   * {@link module:sidepanel/components/members/memberAnalytics.attributeSignals}.
   * Rendered as badges in **every** stage, collapsed included. Empty is an
   * answer — nothing is flagged about this attribute.
   */
  signals?: readonly AttributeSignal[];
  /**
   * The feeding rules that reference this attribute. **Empty is an answer** — no
   * rule currently depends on it — and renders as no block rather than "0 rules".
   */
  rules: AttributeRuleRef[];
  /** Deep-links a dependent rule into the Rules tab. */
  onNavigateToRule?: (ruleId: string) => void;
  /**
   * Opens the full distribution, including every value folded into the
   * aggregated `Other` row. Omit and no "Show all" control is rendered — a
   * drill-in is only offered when something is wired to answer it.
   */
  onShowOther?: () => void;
  /** Starts the card expanded. For stories and tests; the app opens cards on demand. */
  defaultExpanded?: boolean;
}

/**
 * One profile attribute's spread: its key, why it ranks where it does, a
 * segmented spread bar, and — one disclosure down — the values themselves, the
 * blank count, and any rule that depends on it.
 *
 * @example
 * ```tsx
 * <AttributeHealthCard summary={summary} signals={signals} rules={rules} />
 * ```
 *
 * @param props - See {@link AttributeHealthCardProps}.
 */
const AttributeHealthCard: React.FC<AttributeHealthCardProps> = ({
  summary,
  signals = [],
  rules,
  onNavigateToRule,
  onShowOther,
  defaultExpanded = false,
}) => {
  const outliers = new Set(outlierValues(summary));
  const segments = spreadSegments(summary.rows);
  const blanks = summary.rows.find((row) => row.value === NONE_VALUE);
  const tailCount = attributeTailCount(summary);

  return (
    <InsightCard
      title={(titleId) => (
        <code
          id={titleId}
          className="truncate font-mono text-sm font-semibold text-neutral-900"
          title={summary.label}
        >
          {summary.key}
        </code>
      )}
      subject={summary.key}
      revealName="value breakdown"
      defaultExpanded={defaultExpanded}
      badges={
        signals.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {signals.map((signal) => (
              <li key={signal.kind}>
                <Badge variant={SIGNAL_VARIANT[signal.kind]} title={signal.description}>
                  {signal.label}
                </Badge>
              </li>
            ))}
          </ul>
        ) : undefined
      }
      headline={
        <>
          <AttributeSpreadBar rows={summary.rows} />
          <p className="text-xs text-neutral-600">
            {summary.distinct.toLocaleString()} value{summary.distinct === 1 ? '' : 's'} ·{' '}
            {Math.round(summary.fillRate)}% populated
          </p>
        </>
      }
    >
      {segments.length > 0 && (
        <ul className="space-y-1">
          {segments.map(({ row, background }) => (
            <li
              key={row.value}
              className="flex items-center justify-between gap-(--sp-inline) text-xs"
            >
              <span className="flex min-w-0 items-center gap-(--sp-inline)">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-xs"
                  style={{ background }}
                />
                <span
                  className={`min-w-0 truncate font-mono ${
                    outliers.has(row.value) ? 'text-warning-text' : 'text-neutral-700'
                  }`}
                  title={outliers.has(row.value) ? 'Diverges from the dominant value' : row.label}
                >
                  {outliers.has(row.value) && (
                    /* The marker is text, not colour alone: colour is not an
                     accessible signal on its own, and this list is read as much
                     as it is scanned. */
                    <span className="me-1 font-sans font-medium">Outlier:</span>
                  )}
                  {row.label}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-neutral-500">
                {row.count.toLocaleString()} ({Math.round(row.pct)}%)
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* A blank is the absence of a value, not a value people share, so it gets
        its own line rather than a row in the list above and a segment in the bar.
        Omitted when the attribute is fully populated. */}
      {blanks && blanks.count > 0 && (
        <p className="border-t border-neutral-100 pt-2 text-xs text-neutral-500">
          Blank in {blanks.count.toLocaleString()} of {summary.total.toLocaleString()} members (
          {Math.round(blanks.pct)}%) — not a value.
        </p>
      )}

      {/* Stage three. Offered only when a caller can answer it, and only when
        there is genuinely something the card is not showing. */}
      {onShowOther && tailCount > 0 && (
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          icon="chevron-right"
          iconPosition="right"
          onClick={onShowOther}
        >
          Show all {summary.distinct.toLocaleString()} values
        </Button>
      )}

      {/* Empty is an answer: no rule depends on this attribute today. Saying
        "0 rules" would read as a defect rather than as a fact about coupling. */}
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
    </InsightCard>
  );
};

export default AttributeHealthCard;
