/**
 * Tests for the bucket section of the expanded activity bar.
 *
 * The subject is the rule that keeps the bar short: a bucket earns a full row by
 * being under strain, and everything else collapses to one line. Get that wrong
 * in either direction and the feature fails — too eager and the bar grows with
 * the org, too shy and the exhausted bucket the user is waiting on is invisible.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BucketList from './BucketList';
import BucketRow, { deservesTrack, isStrained, headroomPercent } from './BucketRow';
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

describe('headroomPercent', () => {
  it('is null for a bucket Okta has not reported on', () => {
    // Unknown is not exhausted. A gauge that renders one as the other is a lie
    // the user might act on.
    expect(headroomPercent(bucket({ bucket: '/api/v1/users', limit: null, remaining: null }))).toBe(
      null,
    );
  });

  it('is null rather than Infinity for a zero limit', () => {
    expect(headroomPercent(bucket({ bucket: '/api/v1/users', limit: 0, remaining: 0 }))).toBe(null);
  });

  it('is the remaining fraction as a percentage', () => {
    expect(
      headroomPercent(bucket({ bucket: '/api/v1/users', limit: 600, remaining: 150 })),
    ).toBeCloseTo(25);
  });
});

describe('isStrained', () => {
  it('counts a gated bucket, whatever its headroom says', () => {
    expect(isStrained(bucket({ bucket: '/api/v1/users', gatedUntil: NOW + 5_000 }), 10)).toBe(true);
  });

  it('counts a bucket with work against it', () => {
    expect(isStrained(bucket({ bucket: '/api/v1/users', queued: 3 }), 10)).toBe(true);
    expect(isStrained(bucket({ bucket: '/api/v1/users', active: 1 }), 10)).toBe(true);
    // Planned-only is the new case: work declared but not yet enqueued.
    expect(isStrained(bucket({ bucket: '/api/v1/users', planned: 40 }), 10)).toBe(true);
  });

  it('counts a bucket at or below the org threshold', () => {
    expect(isStrained(bucket({ bucket: '/api/v1/users', limit: 100, remaining: 10 }), 10)).toBe(
      true,
    );
  });

  it('does not count a quiet bucket at full headroom', () => {
    expect(isStrained(bucket({ bucket: '/api/v1/users' }), 10)).toBe(false);
  });

  it('does not count an unobserved, idle bucket — there is nothing to be strained about', () => {
    expect(isStrained(bucket({ bucket: '/api/v1/meta', limit: null, remaining: null }), 10)).toBe(
      false,
    );
  });

  it('follows the org threshold rather than a fixed line', () => {
    const thirtyPercentLeft = bucket({ bucket: '/api/v1/users', limit: 100, remaining: 30 });
    expect(isStrained(thirtyPercentLeft, 10)).toBe(false);
    expect(isStrained(thirtyPercentLeft, 35)).toBe(true);
  });
});

describe('deservesTrack', () => {
  it('keeps the lane of a bucket that has just gone quiet', () => {
    // The case the whole ADR-0070 memory exists for: the queue drained, so the
    // bucket is no longer strained — and it must not vanish from under the user
    // at that exact instant.
    const justFinished = bucket({ bucket: '/api/v1/users', lastActiveAt: NOW - 4_000 });

    expect(isStrained(justFinished, 10)).toBe(false);
    expect(deservesTrack(justFinished, 10)).toBe(true);
  });

  it('still collapses a bucket that has never settled anything', () => {
    expect(deservesTrack(bucket({ bucket: '/api/v1/policies' }), 10)).toBe(false);
  });

  it('keeps a strained bucket whether or not it has ever settled anything', () => {
    expect(deservesTrack(bucket({ bucket: '/api/v1/users', queued: 3 }), 10)).toBe(true);
  });
});

describe('BucketList', () => {
  it('renders nothing at all when no bucket has been seen', () => {
    const { container } = render(<BucketList buckets={[]} lowThresholdPercent={10} now={NOW} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('collapses every quiet bucket into one line and names them', () => {
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

    expect(screen.queryByTestId('activity-bucket-/api/v1/groups')).not.toBeInTheDocument();
    const quiet = screen.getByTestId('activity-buckets-quiet');
    expect(quiet).toHaveTextContent('3 buckets idle');
    expect(quiet).toHaveTextContent('groups, policies, meta');
  });

  it('promotes a strained bucket to a full row and leaves the rest collapsed', () => {
    render(
      <BucketList
        buckets={[
          bucket({ bucket: '/api/v1/users', limit: 600, remaining: 30, planned: 500 }),
          bucket({ bucket: '/api/v1/groups' }),
          bucket({ bucket: '/api/v1/policies' }),
        ]}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    const row = screen.getByTestId('activity-bucket-/api/v1/users');
    expect(row).toHaveAttribute('data-low', 'true');
    expect(row).toHaveTextContent('30/600');
    expect(row).toHaveTextContent('500 planned');
    expect(screen.getByTestId('activity-buckets-quiet')).toHaveTextContent('2 buckets idle');
  });

  it('keeps a lane for a bucket that has finished working, and collapses one that never did', () => {
    render(
      <BucketList
        buckets={[
          bucket({ bucket: '/api/v1/users', lastActiveAt: NOW - 30_000 }),
          bucket({ bucket: '/api/v1/policies' }),
        ]}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    expect(screen.getByTestId('activity-bucket-/api/v1/users')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-bucket-/api/v1/policies')).not.toBeInTheDocument();
    expect(screen.getByTestId('activity-buckets-quiet')).toHaveTextContent('1 bucket idle');
  });

  it('names what it dropped rather than truncating silently', () => {
    // Four strained buckets, a cap of two: the other two must still be accounted
    // for, or the bar reads as "everything else is fine" when it is not.
    render(
      <BucketList
        buckets={[
          bucket({ bucket: '/api/v1/users', queued: 5 }),
          bucket({ bucket: '/api/v1/groups', queued: 4 }),
          bucket({ bucket: '/api/v1/apps', queued: 3 }),
          bucket({ bucket: '/api/v1/zones', queued: 2 }),
        ]}
        lowThresholdPercent={10}
        now={NOW}
        maxRows={2}
      />,
    );

    expect(screen.getByTestId('activity-bucket-/api/v1/users')).toBeInTheDocument();
    expect(screen.getByTestId('activity-bucket-/api/v1/groups')).toBeInTheDocument();
    expect(screen.getByTestId('activity-buckets-quiet')).toHaveTextContent('apps, zones');
  });

  it('keeps the scheduler-s pressure order rather than re-sorting', () => {
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

    const rows = screen.getAllByTestId(/^activity-bucket-/);
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'activity-bucket-/api/v1/zones',
      'activity-bucket-/api/v1/apps',
    ]);
  });
});

describe('BucketRow', () => {
  it('says "not reported" rather than 0/0 for an unobserved bucket', () => {
    render(
      <BucketRow
        bucket={bucket({ bucket: '/api/v1/meta', limit: null, remaining: null, planned: 2 })}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    expect(screen.getByTestId('activity-bucket-/api/v1/meta')).toHaveTextContent('not reported');
    expect(screen.getByTestId('activity-bucket-/api/v1/meta')).not.toHaveAttribute('data-low');
  });

  it('counts down to the moment the gate lifts', () => {
    render(
      <BucketRow
        bucket={bucket({ bucket: '/api/v1/users', gatedUntil: NOW + 24_000 })}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    expect(screen.getByTestId('activity-bucket-cooldown-/api/v1/users')).toHaveTextContent('24s');
    expect(screen.getByTestId('activity-bucket-/api/v1/users')).toHaveAttribute(
      'data-gated',
      'true',
    );
  });

  it('drops the cooldown pill once the gate has lifted', () => {
    render(
      <BucketRow
        bucket={bucket({ bucket: '/api/v1/users', gatedUntil: NOW - 1 })}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    expect(screen.queryByTestId('activity-bucket-cooldown-/api/v1/users')).not.toBeInTheDocument();
  });

  it('shows minutes and seconds for a long gate', () => {
    render(
      <BucketRow
        bucket={bucket({ bucket: '/api/v1/users', gatedUntil: NOW + 95_000 })}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    expect(screen.getByTestId('activity-bucket-cooldown-/api/v1/users')).toHaveTextContent(
      '1m 35s',
    );
  });

  /**
   * ADR-0070's load-bearing half. A remembered bucket keeps its lane after its
   * queue drains, its plan is reaped and its header observation expires — and
   * what is retained is the lane's *existence*, never a number. These assert the
   * negative, because the failure mode is not an absent figure but a stale one
   * presented as current.
   */
  describe('a remembered, idle bucket', () => {
    const remembered = bucket({
      bucket: '/api/v1/users',
      limit: null,
      remaining: null,
      resetAt: null,
      lastActiveAt: NOW - 125_000,
    });

    it('says it is at rest, and says how long ago in words', () => {
      render(<BucketRow bucket={remembered} lowThresholdPercent={10} now={NOW} />);

      const row = screen.getByTestId('activity-bucket-/api/v1/users');
      expect(row).toHaveAttribute('data-state', 'at-rest');
      expect(row).toHaveTextContent('at rest');
      expect(row).toHaveTextContent('last active 2m ago');
    });

    it('shows no budget figure that could be mistaken for a live reading', () => {
      render(<BucketRow bucket={remembered} lowThresholdPercent={10} now={NOW} />);

      const row = screen.getByTestId('activity-bucket-/api/v1/users');
      expect(row).toHaveTextContent('not reported');
      // No `remaining/limit` pair anywhere in the lane, and no percentage — the
      // two shapes a stale reading would take.
      expect(row.textContent).not.toMatch(/\d+\s*\/\s*\d+/);
      expect(row.textContent).not.toMatch(/%/);
      // Nor any of the work counts, which are genuinely zero and are drawn as an
      // empty lane rather than printed as "0 in flight".
      expect(row).not.toHaveTextContent('in flight');
      expect(row).not.toHaveTextContent('queued');
      expect(row).not.toHaveTextContent('planned');
      expect(row).not.toHaveAttribute('data-low');
      expect(row).not.toHaveAttribute('data-gated');
    });

    it('never prints NaN when the timestamp is missing rather than null', () => {
      // The bug this pins: `lastActiveAt` is typed `number | null`, so the guard
      // was written `!== null` — but the value crosses the service-worker
      // boundary, and `undefined !== null` is `true`. That put `now - undefined`
      // into the age, and the lane read `last active NaNh ago`. A panel running
      // ahead of a worker that has not restarted yet produces exactly this, and
      // so would any future rename of the field.
      //
      // The cast is the point of the test: it reproduces a message this repo's
      // types say cannot arrive, because the boundary does not enforce them.
      const missing = { ...remembered } as Record<string, unknown>;
      delete missing.lastActiveAt;

      render(
        <BucketRow bucket={missing as unknown as BucketState} lowThresholdPercent={10} now={NOW} />,
      );

      const row = screen.getByTestId('activity-bucket-/api/v1/users');
      expect(row).toHaveTextContent('at rest');
      expect(row.textContent).not.toMatch(/NaN/);
      expect(row).not.toHaveTextContent('last active');
    });

    it('never prints NaN when the clock itself is unreadable', () => {
      // The other half. `Math.max(0, NaN)` is NaN, so `sinceLabel`'s clamp does
      // not stop a bad `now` on its own — every comparison after it is false and
      // it falls through to the hours branch.
      render(<BucketRow bucket={remembered} lowThresholdPercent={10} now={Number.NaN} />);

      expect(screen.getByTestId('activity-bucket-/api/v1/users').textContent).not.toMatch(/NaN/);
    });

    it('does not grant a lane on a missing timestamp', () => {
      // `deservesTrack` read the same field the same way, so a bucket with no
      // timestamp at all was earning a lane it had not earned — the rack would
      // list every family the scheduler is merely aware of.
      const missing = { ...bucket({ bucket: '/api/v1/users' }) } as Record<string, unknown>;
      delete missing.lastActiveAt;

      expect(deservesTrack(missing as unknown as BucketState, 10)).toBe(false);
    });

    it('says only "at rest" when the worker was evicted and lastActiveAt is null', () => {
      // No timestamp is fabricated and none is persisted to survive eviction:
      // the activity a timestamp would describe did not survive it either.
      render(
        <BucketRow
          bucket={{ ...remembered, lastActiveAt: null }}
          lowThresholdPercent={10}
          now={NOW}
        />,
      );

      const row = screen.getByTestId('activity-bucket-/api/v1/users');
      expect(row).toHaveTextContent('at rest');
      expect(row).not.toHaveTextContent('last active');
      expect(row).not.toHaveTextContent('ago');
    });
  });

  it('omits the planned figure when nothing is planned', () => {
    render(
      <BucketRow
        bucket={bucket({ bucket: '/api/v1/users', queued: 2 })}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    expect(screen.getByTestId('activity-bucket-/api/v1/users')).not.toHaveTextContent('planned');
  });
});
