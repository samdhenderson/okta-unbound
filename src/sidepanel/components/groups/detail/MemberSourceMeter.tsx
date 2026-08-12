/**
 * @module sidepanel/components/groups/detail/MemberSourceMeter
 * @description Stacked bar + legend showing where a group's members came from — one segment per rule.
 *
 * The bar itself is decorative (`aria-hidden`): every number it encodes is also
 * printed in the legend beneath it, so a screen reader gets the full answer as
 * text rather than an unlabelled graphic. Segment order, labels, colours and
 * percentages come from the pure
 * {@link sidepanel/components/groups/memberSourceBuckets} module — including the
 * mutual exclusivity that lets the segments be added up at all.
 *
 * Three details are deliberate:
 *
 * - **A one-member segment stays legible.** Segments carry a `min-w-1` floor, so
 *   the single two-rule member in a 70-member group is still a visible sliver
 *   with its own legend row rather than a rounding error.
 * - **A zero-count segment is dropped entirely** rather than rendered as an
 *   empty slice or a legend row that says nothing.
 * - **An aggregated tail states what it hid.** Past the chart ramp's six stops
 *   the remaining rules fold into `Other rules`, which prints `+N more rules`;
 *   nothing is silently truncated.
 */
import React from 'react';
import type { MemberSourceBreakdown } from '../../../../shared/membership/groupSource';
import { toMemberSourceSegments } from '../memberSourceBuckets';

/** Props for {@link MemberSourceMeter}. */
interface MemberSourceMeterProps {
  /** The analyzed manual-vs-rule split for the group. */
  breakdown: MemberSourceBreakdown;
  /**
   * How many rules may get their own colour before the tail aggregates into
   * `Other rules`. Defaults to the chart ramp's six stops.
   */
  maxRules?: number;
}

/**
 * Renders the member-source split as a stacked meter with a text legend, one
 * segment per attributing rule.
 *
 * @example
 * ```tsx
 * <MemberSourceMeter breakdown={breakdown} />
 * ```
 */
const MemberSourceMeter: React.FC<MemberSourceMeterProps> = ({ breakdown, maxRules }) => {
  const segments = toMemberSourceSegments(breakdown, { maxRules });
  const filled = segments.filter((segment) => segment.count > 0);

  if (filled.length === 0) {
    return <p className="text-sm text-neutral-500">No members to attribute.</p>;
  }

  return (
    <div className="space-y-3">
      <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-md bg-neutral-100">
        {filled.map((segment) => (
          <div
            key={segment.key}
            className={`min-w-1 ${segment.barClass}`}
            style={{ width: `${segment.percent}%`, backgroundColor: segment.color }}
          />
        ))}
      </div>

      <ul className="space-y-1.5">
        {filled.map((segment) => (
          <li key={segment.key} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-baseline gap-2">
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${segment.dotClass}`}
                style={{ backgroundColor: segment.color }}
              />
              <span className="truncate text-neutral-700" title={segment.description}>
                {segment.label}
              </span>
              {segment.aggregatedRuleCount !== undefined && (
                <span className="shrink-0 text-xs text-neutral-500" title={segment.description}>
                  +{segment.aggregatedRuleCount} more rule
                  {segment.aggregatedRuleCount === 1 ? '' : 's'}
                </span>
              )}
            </span>
            <span className="shrink-0 text-neutral-900">
              <span className="font-semibold">{segment.count.toLocaleString()}</span>{' '}
              <span className="text-xs text-neutral-500">({Math.round(segment.percent)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MemberSourceMeter;
