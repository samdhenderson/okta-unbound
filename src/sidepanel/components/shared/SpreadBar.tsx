/**
 * @module sidepanel/components/shared/SpreadBar
 * @description A distribution as a single segmented bar: shares drawn to scale,
 * with the paint decided by the caller.
 *
 * The drawing half of `AttributeSpreadBar`, lifted out when the MFA coverage
 * cards needed the same bar over a distribution the attribute ramp paints wrong.
 * This component owns the geometry and nothing else — **which colour a segment
 * takes is always the caller's decision**, because the two surfaces answer that
 * question differently (a sequential ramp by row order for attribute values, a
 * lookup by bucket name for MFA enrollment) and folding both rules in here would
 * make this component the place those rules drift apart.
 *
 * ## Why it is `aria-hidden`
 *
 * The bar states proportions and no labels, so on its own it is not readable by
 * anybody: sighted readers get shares without names and have to expand the card
 * for the list, and the segment tooltips are pointer-only. Rather than synthesise
 * a long `aria-label` that duplicates that list badly, the bar is decoration over
 * content its card states in text — the counts beside it, the itemised list one
 * disclosure away. A caller that renders this bar **must** state the same
 * distribution in words somewhere a screen reader reaches.
 */
import React from 'react';

/** One drawn segment. */
export interface SpreadBarSegment {
  /** React key, unique within the bar. */
  key: string;
  /** Pointer tooltip — the caller's wording, since only it knows the units. */
  title: string;
  /** The segment's share. Drawn through `flex-grow`, so any consistent unit works. */
  count: number;
  /** A CSS `background` value. Comes from the theme's chart palette, never a literal. */
  background: string;
}

/** Props for {@link SpreadBar}. */
export interface SpreadBarProps {
  /** The segments to draw, in order. Renders nothing when empty. */
  segments: readonly SpreadBarSegment[];
  /** Layout classes only — never colour. */
  className?: string;
}

/**
 * A segmented proportion bar.
 *
 * @example
 * ```tsx
 * <SpreadBar
 *   segments={rows.map((row) => ({
 *     key: row.value,
 *     title: `${row.label} — ${row.count} (${Math.round(row.pct)}%)`,
 *     count: row.count,
 *     background: paintFor(row.value),
 *   }))}
 * />
 * ```
 *
 * @param props - See {@link SpreadBarProps}.
 */
const SpreadBar: React.FC<SpreadBarProps> = ({ segments, className = '' }) => {
  if (segments.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={`flex h-3 w-full gap-px overflow-hidden rounded-full bg-neutral-100 ${className}`}
    >
      {segments.map((segment) => (
        <div
          key={segment.key}
          title={segment.title}
          /*
            Data-driven geometry, not a hand-maintained pixel scale: the segment's
            share *is* its count, so `flex-grow` carries it and no width has to be
            computed. `min-width` keeps a one-member value from vanishing to a
            hairline.
          */
          style={{ background: segment.background, flexGrow: segment.count, flexBasis: 0 }}
          className="min-w-1"
        />
      ))}
    </div>
  );
};

export default SpreadBar;
