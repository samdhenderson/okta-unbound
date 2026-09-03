/**
 * @module sidepanel/components/groups/detail/AttributeSpreadBar
 * @description One attribute's value composition as a single segmented bar.
 *
 * Replaces the fill meter the Insights card used to carry. A fill meter answers
 * "how much of this is populated", which the card already states in words; the
 * bar answers "and how is the populated part *distributed*", which nothing on a
 * collapsed card answered before.
 *
 * ## Blanks are not a segment
 *
 * The bar describes populated members only. A blank is the absence of a value,
 * not a value people share, and giving it a segment put "nobody filled this in"
 * on the same footing as "forty people are in Engineering". The blank count gets
 * its own line in the card's expanded body instead.
 *
 * ## The tail is hatched, never tinted
 *
 * The aggregated `Other` row is drawn with {@link CHART_TAIL_HATCH} rather than a
 * flat neutral. A flat fill on a bar whose every other segment is a value reads
 * as one more value; a hatch reads as an aggregate, and it survives greyscale —
 * so "this is the rest, not a thing" is not carried by colour alone.
 *
 * ## Why it is `aria-hidden`
 *
 * The bar states proportions and no labels, so on its own it is not readable by
 * anybody: sighted readers get shares without names and have to expand the card
 * for the value list, and the segment tooltips are pointer-only. Rather than
 * synthesise a long `aria-label` that duplicates that list badly, the bar is
 * decoration over content the card states in text — the value count and fill
 * rate beside it, the itemised list one disclosure away.
 */
import React from 'react';
import { spreadSegments } from './attributeSpread';
import type { BreakdownRow } from '../../members/memberAnalytics';

/** Props for {@link AttributeSpreadBar}. */
export interface AttributeSpreadBarProps {
  /** One attribute's distribution rows (blanks and the tail included; both are handled). */
  rows: readonly BreakdownRow[];
  /** Layout classes only — never colour. */
  className?: string;
}

/**
 * A segmented proportion bar for one attribute's populated value spread, with
 * the folded-away tail hatched rather than tinted.
 *
 * @example
 * ```tsx
 * <AttributeSpreadBar rows={summary.rows} />
 * ```
 *
 * @param props - See {@link AttributeSpreadBarProps}.
 */
const AttributeSpreadBar: React.FC<AttributeSpreadBarProps> = ({ rows, className = '' }) => {
  const segments = spreadSegments(rows);
  if (segments.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={`flex h-3 w-full gap-px overflow-hidden rounded-full bg-neutral-100 ${className}`}
    >
      {segments.map((segment) => (
        <div
          key={segment.row.value}
          title={
            segment.isTail
              ? `${segment.row.label} — ${segment.row.count.toLocaleString()} members`
              : `${segment.row.label} — ${segment.row.count.toLocaleString()} (${Math.round(segment.row.pct)}%)`
          }
          /*
            Data-driven geometry, not a hand-maintained pixel scale: the segment's
            share *is* its member count, so `flex-grow` carries it and no width
            has to be computed. `min-width` keeps a one-member value from
            vanishing to a hairline.
          */
          style={{ background: segment.background, flexGrow: segment.row.count, flexBasis: 0 }}
          className="min-w-1"
        />
      ))}
    </div>
  );
};

export default AttributeSpreadBar;
