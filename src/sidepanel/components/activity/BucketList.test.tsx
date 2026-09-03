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
import BucketRow, { isStrained, headroomPercent } from './BucketRow';
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
