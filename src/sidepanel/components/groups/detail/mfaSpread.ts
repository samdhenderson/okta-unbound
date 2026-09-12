/**
 * @module sidepanel/components/groups/detail/mfaSpread
 * @description The paint the MFA enrollment partition takes — pure, so the bar
 * and the bucket list beneath it cannot disagree about which colour a bucket is.
 *
 * The MFA sibling of {@link module:sidepanel/components/groups/detail/attributeSpread},
 * and it exists separately for one reason: `spreadSegments` walks a sequential
 * ramp in row order, which is correct where the order is the ranking and wrong
 * where the rows are named buckets. See {@link MFA_ENROLLMENT_PAINT}.
 */
import { MFA_ENROLLMENT_PAINT } from '../../../theme/chartPalette';
import type { BreakdownRow } from '../../members/memberAnalytics';
import type { SpreadSegment } from './attributeSpread';

/**
 * Paint for a bucket this module does not know about. Unreachable through
 * {@link module:sidepanel/components/members/memberAnalytics.computeMfaEnrollment},
 * which emits exactly the three named buckets — a hand-built row would have to
 * reach it.
 */
const UNKNOWN_BUCKET = 'var(--color-neutral-300)';

/**
 * The segments an enrollment partition draws, in row order, each painted for the
 * bucket it names rather than for where it sits.
 *
 * Zero-count buckets are dropped so an empty bucket contributes no sliver to the
 * bar; the card's expanded list still names all three, because "nobody is here"
 * is an answer worth stating in words even when there is nothing to draw.
 *
 * The `none` bucket **is** drawn. It carries the value `'none'`, not the
 * `NONE_VALUE` sentinel `'__none__'` that `spreadSegments` skips — the attribute
 * bar drops blanks because a blank is the absence of a value, whereas "no factors
 * enrolled" is the finding the whole card exists to report.
 *
 * @param rows - The enrollment rows, from `computeMfaEnrollment`.
 * @returns The drawable segments, in the shape the shared spread bar consumes.
 */
export function mfaEnrollmentSegments(rows: readonly BreakdownRow[]): SpreadSegment[] {
  const segments: SpreadSegment[] = [];
  for (const row of rows) {
    if (row.count <= 0) continue;
    segments.push({
      row,
      background: MFA_ENROLLMENT_PAINT[row.value] ?? UNKNOWN_BUCKET,
      isTail: false,
    });
  }
  return segments;
}
