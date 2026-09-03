/**
 * @module sidepanel/components/groups/detail/attributeSpread
 * @description The paint an attribute's value distribution takes — pure, so the
 * bar and the value list beneath it cannot disagree about which colour a value is.
 *
 * Split out of {@link module:sidepanel/components/groups/detail/AttributeSpreadBar}
 * because two surfaces consume it: the bar draws the segments, and the card's
 * expanded value list draws a swatch per row from the same walk. Two independent
 * colour walks would eventually drift apart, and the swatch is the only thing
 * tying a row to its slice.
 */
import { CHART_TAIL_HATCH, INDIGO_RAMP } from '../../../theme/chartPalette';
import { NONE_VALUE, OTHER_VALUE, type BreakdownRow } from '../../members/memberAnalytics';

/**
 * Paint for a value past the ramp's last stop. A token, never a hex — and the
 * ramp is long enough that reaching this means the summary was hand-built.
 */
const RAMP_FALLBACK = 'var(--color-primary)';

/** One drawn segment: the row it stands for and the paint it takes. */
export interface SpreadSegment {
  /** The distribution row this segment draws. */
  row: BreakdownRow;
  /** A CSS `background` value — a ramp stop, or the tail's hatch. */
  background: string;
  /** `true` for the aggregated `Other` segment. */
  isTail: boolean;
}

/**
 * The segments a distribution draws, in row order: every populated named value
 * from the sequential ramp, then the aggregated tail in its hatch.
 *
 * Exported so the card's value list can paint each row's swatch with the exact
 * colour its segment took — the swatch is what ties a row to the bar above it,
 * and two independent colour walks would eventually disagree.
 *
 * Values beyond the ramp's last stop reuse it rather than wrapping back to the
 * darkest: wrapping would make the smallest slice the most prominent one.
 *
 * @param rows - One attribute's distribution rows.
 * @returns The drawable segments; blanks and zero-count rows are excluded.
 */
export function spreadSegments(rows: readonly BreakdownRow[]): SpreadSegment[] {
  const segments: SpreadSegment[] = [];
  let rampIndex = 0;
  for (const row of rows) {
    if (row.count <= 0 || row.value === NONE_VALUE) continue;
    if (row.value === OTHER_VALUE) {
      segments.push({ row, background: CHART_TAIL_HATCH, isTail: true });
      continue;
    }
    const stop = INDIGO_RAMP[Math.min(rampIndex, INDIGO_RAMP.length - 1)];
    rampIndex += 1;
    segments.push({ row, background: stop ?? RAMP_FALLBACK, isTail: false });
  }
  return segments;
}
