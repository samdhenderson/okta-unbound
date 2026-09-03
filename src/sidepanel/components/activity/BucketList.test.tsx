/**
 * Tests for the bucket rack of the expanded activity bar.
 *
 * The subject used to be a filter — which buckets earn a full row and which
 * collapse to a summary line. That filter is gone (ADR-0072): the scheduler's
 * published set already answers "which buckets matter", bounded at twelve with
 * LRU eviction by ADR-0070 §5, and filtering it again in the view meant the rack
 * answered a second, differently-shaped question that disagreed with the first at
 * exactly the wrong moment.
 *
 * So the subject is now the absence of a filter, which needs pinning just as
 * hard: a bucket that has never settled anything gets a lane, a bucket that has
 * just gone quiet keeps its lane, and nothing is dropped or summarised away.
 *
 * Per-lane geometry lives in `BucketRow.test.tsx`.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BucketList from './BucketList';
import type { BucketState } from '@/shared/scheduler/types';

const NOW = 1_760_000_000_000;

function bucket(overrides: Partial<BucketState> & { bucket: string }): BucketState {
  return {
    limit: 600,
    remaining: 600,
    resetAt: NOW + 60_000,
    queued: 0,
    active: 0,
    planned: 0,
    gatedUntil: null,
    lastActiveAt: null,
    ...overrides,
  };
}

describe('BucketList', () => {
  it('renders nothing at all when no bucket is being tracked', () => {
    // Not an empty state: a scheduler that has not touched Okta yet is not a
    // condition to report, and a placeholder would grow the bar for no
    // information (ADR-0008).
    const { container } = render(<BucketList buckets={[]} lowThresholdPercent={10} now={NOW} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('gives every published bucket a lane, including one that has never settled anything', () => {
    // The behaviour change. These three would previously have produced no lanes
    // at all and one line of prose naming them.
    render(
      <BucketList
        buckets={[
          bucket({ bucket: '/api/v1/groups' }),
          bucket({ bucket: '/api/v1/policies' }),
          bucket({ bucket: '/api/v1/meta', limit: null, remaining: null }),
        ]}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    expect(screen.getByTestId('activity-bucket-/api/v1/groups')).toBeInTheDocument();
    expect(screen.getByTestId('activity-bucket-/api/v1/policies')).toBeInTheDocument();
    expect(screen.getByTestId('activity-bucket-/api/v1/meta')).toBeInTheDocument();
  });

  it('keeps the lane of a bucket that has just gone quiet', () => {
    // The case ADR-0070's memory exists for: the queue drained, so the bucket is
    // no longer under strain — and it must not vanish from under the user at
    // that exact instant. It survived the old strain filter only by way of a
    // second clause; now there is no filter to survive.
    render(
      <BucketList
        buckets={[bucket({ bucket: '/api/v1/users', lastActiveAt: NOW - 4_000 })]}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    expect(screen.getByTestId('activity-bucket-/api/v1/users')).toHaveAttribute(
      'data-state',
      'at-rest',
    );
  });

  it('summarises nothing away', () => {
    // Seven buckets. The old rack capped at six lanes and named the overflow in
    // prose; this asserts there is no such line left to hide behind.
    render(
      <BucketList
        buckets={[
          bucket({ bucket: '/api/v1/users', queued: 5 }),
          bucket({ bucket: '/api/v1/groups', queued: 4 }),
          bucket({ bucket: '/api/v1/apps', queued: 3 }),
          bucket({ bucket: '/api/v1/zones', queued: 2 }),
          bucket({ bucket: '/api/v1/policies', queued: 1 }),
          bucket({ bucket: '/api/v1/devices' }),
          bucket({ bucket: '/api/v1/idps' }),
        ]}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    expect(screen.getAllByTestId(/^activity-bucket-\/api/)).toHaveLength(7);
    expect(screen.queryByTestId('activity-buckets-quiet')).not.toBeInTheDocument();
  });

  it("keeps the scheduler's pressure order rather than re-sorting", () => {
    render(
      <BucketList
        buckets={[
          bucket({ bucket: '/api/v1/zones', queued: 1 }),
          bucket({ bucket: '/api/v1/apps', queued: 1 }),
        ]}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    const rows = screen.getAllByTestId(/^activity-bucket-\/api/);
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'activity-bucket-/api/v1/zones',
      'activity-bucket-/api/v1/apps',
    ]);
  });

  it('keys the lane vocabulary once, beneath the lanes', () => {
    // The legend is what lets six lanes be read by shape in one look instead of
    // six label lines in sequence, and it carries the one thing no single lane
    // can say: that a pale tail is headroom, not absence.
    render(
      <BucketList
        buckets={[bucket({ bucket: '/api/v1/users', active: 2 })]}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    const legend = screen.getByTestId('activity-rack-legend');
    for (const term of ['running', 'queued', 'budget remaining', 'cooling down', 'at rest']) {
      expect(legend).toHaveTextContent(term);
    }
  });
});
