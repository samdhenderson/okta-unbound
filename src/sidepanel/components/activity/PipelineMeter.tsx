/**
 * @module sidepanel/components/activity/PipelineMeter
 * @description The four-state bar that shows where an operation's requests are:
 * already spent, in flight, queued, or still only planned.
 *
 * Four segments in one track rather than four numbers, because the question a
 * user actually has — "how much of this is still to come?" — is a comparison of
 * magnitudes, and a bar answers that at a glance where four integers do not.
 *
 * @see `ADR-0060` — the declared-work ledger these segments render.
 */
import React from 'react';
import { PLANNED_HATCH } from './hatches';

/** The four states a request in an operation can be in, in pipeline order. */
export interface PipelineCounts {
  /** Settled — the budget is gone. */
  spent: number;
  /** Dispatched, awaiting a response. */
  active: number;
  /** Enqueued, not yet dispatched. */
  queued: number;
  /** Declared but not yet enqueued (`shared/scheduler/plan`). */
  planned: number;
}

/** Props for {@link PipelineMeter}. */
export interface PipelineMeterProps {
  counts: PipelineCounts;
  /**
   * Marks the total as a floor rather than a fact — some leg's estimate is
   * `atLeast` or `unknown`. The planned segment is hatched instead of solid, so
   * "we expect at least this much more" never reads as "we expect exactly this".
   */
  approximate?: boolean;
  /**
   * Accessible description of what the meter shows. Required: the meter is the
   * only rendering of these numbers in the collapsed-bucket case, so it cannot
   * be `aria-hidden` decoration.
   */
  label: string;
}

/** One segment. Rendered only when it has width, so zero-width slivers never appear. */
function Segment({ fraction, style }: { fraction: number; style: React.CSSProperties }) {
  if (fraction <= 0) return null;
  return (
    <div aria-hidden="true" className="h-full" style={{ width: `${fraction * 100}%`, ...style }} />
  );
}

/**
 * Render the pipeline meter.
 *
 * An all-zero pipeline renders as an empty track rather than nothing, so a row
 * that gains work does not change height — the no-reflow contract of ADR-0008.
 *
 * @param props - See {@link PipelineMeterProps}.
 */
const PipelineMeter: React.FC<PipelineMeterProps> = ({ counts, approximate = false, label }) => {
  const total = counts.spent + counts.active + counts.queued + counts.planned;
  const share = (n: number) => (total > 0 ? n / total : 0);

  return (
    <div
      role="img"
      aria-label={label}
      data-testid="pipeline-meter"
      data-approximate={approximate ? 'true' : undefined}
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-100"
    >
      <Segment fraction={share(counts.spent)} style={{ backgroundColor: 'var(--color-primary)' }} />
      <Segment fraction={share(counts.active)} style={{ backgroundColor: 'var(--color-info)' }} />
      <Segment
        fraction={share(counts.queued)}
        style={{ backgroundColor: 'var(--color-neutral-300)' }}
      />
      <Segment
        fraction={share(counts.planned)}
        style={
          approximate
            ? { backgroundImage: PLANNED_HATCH }
            : { backgroundColor: 'var(--color-neutral-400)' }
        }
      />
    </div>
  );
};

export default PipelineMeter;
