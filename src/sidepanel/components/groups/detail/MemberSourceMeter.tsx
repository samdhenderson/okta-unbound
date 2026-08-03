/**
 * @module sidepanel/components/groups/detail/MemberSourceMeter
 * @description Stacked bar + legend showing where a group's members came from.
 *
 * The bar itself is decorative (`aria-hidden`): every number it encodes is also
 * printed in the legend beneath it, so a screen reader gets the full answer as
 * text rather than an unlabelled graphic. Bucket order, labels, colours and
 * percentages come from the pure
 * {@link sidepanel/components/groups/memberSourceBuckets} module — including
 * the third "Indeterminate" bucket, which stays at `0` until the classifier
 * reports it.
 */
import React from 'react';
import type { MemberSourceBreakdown } from '../../../../shared/membership/groupSource';
import { toMemberSourceBuckets } from '../memberSourceBuckets';

/** Props for {@link MemberSourceMeter}. */
interface MemberSourceMeterProps {
  /** The analyzed manual-vs-rule split for the group. */
  breakdown: MemberSourceBreakdown;
}

/**
 * Renders the member-source split as a stacked meter with a text legend.
 *
 * @example
 * ```tsx
 * <MemberSourceMeter breakdown={breakdown} />
 * ```
 */
const MemberSourceMeter: React.FC<MemberSourceMeterProps> = ({ breakdown }) => {
  const buckets = toMemberSourceBuckets(breakdown);
  const filled = buckets.filter((bucket) => bucket.count > 0);

  if (filled.length === 0) {
    return <p className="text-sm text-neutral-500">No members to attribute.</p>;
  }

  return (
    <div className="space-y-3">
      <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-md bg-neutral-100">
        {filled.map((bucket) => (
          <div
            key={bucket.key}
            className={bucket.barClass}
            style={{ width: `${bucket.percent}%` }}
          />
        ))}
      </div>

      <ul className="space-y-1.5">
        {filled.map((bucket) => (
          <li key={bucket.key} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-baseline gap-2">
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${bucket.dotClass}`}
              />
              <span className="text-neutral-700" title={bucket.description}>
                {bucket.label}
              </span>
            </span>
            <span className="shrink-0 text-neutral-900">
              <span className="font-semibold">{bucket.count.toLocaleString()}</span>{' '}
              <span className="text-xs text-neutral-500">({Math.round(bucket.percent)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MemberSourceMeter;
