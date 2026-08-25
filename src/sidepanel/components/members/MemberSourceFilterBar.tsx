/**
 * @module sidepanel/components/members/MemberSourceFilterBar
 * @description The membership-source meter, as a filter control.
 *
 * `groups/detail/MemberSourceMeter` renders the same split as a bar plus a text
 * legend — a readout. This is the same information where the reader can *act* on
 * it: the bar for proportion at a glance, and one {@link FilterPill} per segment
 * to narrow the list to the people in it.
 *
 * ## Why pills rather than a clickable bar
 *
 * "Click a segment to filter" is the obvious reading of a meter, and it is the
 * wrong control here. At the 360px panel floor a one-member segment is a
 * `min-w-1` sliver; making it the hit target puts a filter behind a 4px button.
 * The pills carry the same colour swatch, so the mapping stays legible, and each
 * is a full-size target with its own accessible name and count.
 *
 * The bar itself stays `aria-hidden`, exactly as `MemberSourceMeter` has it:
 * every number it encodes is printed on the pills beside it, so a screen reader
 * gets the whole answer as text rather than an unlabelled graphic.
 *
 * ## Nothing the readout said is dropped
 *
 * This is the *whole* readout on the Members tab — `MemberSourceMeter` is not
 * rendered beside it, because a legend and a pill row carrying the same numbers
 * is the same fact twice down a 360px column. So everything that suite pins has
 * to survive here: each bucket's label, its share as a percentage, and — for the
 * aggregated tail — **how many rules it folded in**. `memberSourceBuckets` states
 * that last one as a hard rule: anything past the ramp aggregates into `Other
 * rules` with its dropped-rule count stated, never silently truncated. It is a
 * line of text under the pills, not a `title`, because a fact nobody can read
 * without hovering is not stated.
 *
 * `MemberSourceMeter` itself is untouched and still owns the groups-list row
 * expansion (`GroupListItemDetails`), which is a readout with nothing to filter.
 *
 * ## The aggregated tail
 *
 * Past the chart ramp's stops, `toMemberSourceSegments` folds the remaining
 * rules into `Other rules`. `memberSourceIndex` deliberately does not assign
 * anyone to that bucket — which rules get folded depends on how wide the meter
 * is, which is presentation. Resolving it is this component's caller's job, and
 * {@link MemberExplorer} does it by unioning the `rule:<id>` sets the meter did
 * not show.
 */
import React from 'react';
import FilterPill from '../shared/FilterPill';
import type { MemberSourceBucket } from '../groups/memberSourceBuckets';

/** Props for {@link MemberSourceFilterBar}. */
export interface MemberSourceFilterBarProps {
  /** The exclusive segments, in render order, from `toMemberSourceSegments`. */
  segments: MemberSourceBucket[];
  /** Bucket keys currently filtered on. */
  activeKeys: ReadonlySet<string>;
  /** Toggle one bucket's filter. */
  onToggle: (key: string, label: string) => void;
  /** Drop every source filter — the "All" pill. */
  onClearAll: () => void;
  /** Total analyzed members, shown on the "All" pill. */
  total: number;
}

/** The source meter with a filter pill per segment. */
const MemberSourceFilterBar: React.FC<MemberSourceFilterBarProps> = ({
  segments,
  activeKeys,
  onToggle,
  onClearAll,
  total,
}) => {
  // A zero-count segment is dropped rather than drawn as an empty slice or
  // offered as a pill that would filter to nobody.
  const filled = segments.filter((segment) => segment.count > 0);
  const aggregated = filled.reduce(
    (count, segment) => count + (segment.aggregatedRuleCount ?? 0),
    0,
  );
  if (filled.length === 0) return null;

  return (
    <div className="space-y-2">
      <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-md bg-neutral-100">
        {filled.map((segment) => (
          <div
            key={segment.key}
            className={`min-w-1 ${segment.barClass}`}
            style={{ width: `${segment.percent}%`, backgroundColor: segment.color }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterPill
          active={activeKeys.size === 0}
          onClick={onClearAll}
          title={`All ${total.toLocaleString()} analyzed members`}
        >
          All {total.toLocaleString()}
        </FilterPill>
        {filled.map((segment) => (
          <FilterPill
            key={segment.key}
            active={activeKeys.has(segment.key)}
            onClick={() => onToggle(segment.key, segment.label)}
            title={segment.description}
          >
            {/* The swatch is what ties a pill back to its slice of the bar; the
                bar is `aria-hidden`, so the colour is decoration here too and
                the pill's text carries the meaning. */}
            <span
              aria-hidden="true"
              className={`me-1.5 inline-block h-2 w-2 shrink-0 rounded-full align-middle ${segment.dotClass}`}
              style={{ backgroundColor: segment.color }}
            />
            {segment.label} {segment.count.toLocaleString()}{' '}
            <span className="font-normal opacity-80">({segment.percent}%)</span>
          </FilterPill>
        ))}
      </div>

      {/* The aggregated tail always states what it hid. */}
      {aggregated > 0 && (
        <p className="text-xs text-neutral-600">
          &ldquo;Other rules&rdquo; folds in +{aggregated} more rule{aggregated === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  );
};

export default MemberSourceFilterBar;
