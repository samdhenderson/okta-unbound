/**
 * Tests for the reset timeline.
 *
 * Two properties carry the feature: it must be absent unless a gate is actually
 * armed (an idle bar that grows a timeline has broken the no-reflow contract of
 * ADR-0008), and when several buckets are cooling down it must place them on one
 * axis in the order they come back — which is the question a list of separate
 * countdowns cannot answer.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResetTimeline, { resetMarks } from './ResetTimeline';
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
    ...overrides,
  };
}

describe('resetMarks', () => {
  it('drops gates that have already lifted rather than pinning them at zero', () => {
    const { marks } = resetMarks([bucket({ bucket: '/api/v1/users', gatedUntil: NOW - 1 })], NOW);

    expect(marks).toEqual([]);
  });

  it('orders marks by when they lift, not by bucket name', () => {
    const { marks } = resetMarks(
      [
        bucket({ bucket: '/api/v1/apps', gatedUntil: NOW + 40_000 }),
        bucket({ bucket: '/api/v1/users', gatedUntil: NOW + 10_000 }),
      ],
      NOW,
    );

    expect(marks.map((mark) => mark.bucket)).toEqual(['/api/v1/users', '/api/v1/apps']);
  });

  it('keeps the axis at least a minute wide so a short gate does not fill it', () => {
    const { marks, windowMs } = resetMarks(
      [bucket({ bucket: '/api/v1/users', gatedUntil: NOW + 3_000 })],
      NOW,
    );

    expect(windowMs).toBe(60_000);
    expect(marks[0].offsetPercent).toBeCloseTo(5);
  });

  it('widens past a minute for a long gate, placing the furthest at the end', () => {
    const { marks, windowMs } = resetMarks(
      [
        bucket({ bucket: '/api/v1/users', gatedUntil: NOW + 60_000 }),
        bucket({ bucket: '/api/v1/apps', gatedUntil: NOW + 120_000 }),
      ],
      NOW,
    );

    expect(windowMs).toBe(120_000);
    expect(marks[0].offsetPercent).toBeCloseTo(50);
    expect(marks[1].offsetPercent).toBeCloseTo(100);
  });
});

describe('ResetTimeline', () => {
  it('renders nothing while no gate is armed', () => {
    const { container } = render(
      <ResetTimeline buckets={[bucket({ bucket: '/api/v1/users' })]} now={NOW} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('says when each gated bucket comes back, soonest first', () => {
    render(
      <ResetTimeline
        buckets={[
          bucket({ bucket: '/api/v1/apps', gatedUntil: NOW + 95_000 }),
          bucket({ bucket: '/api/v1/users', gatedUntil: NOW + 24_000 }),
        ]}
        now={NOW}
      />,
    );

    const timeline = screen.getByTestId('activity-reset-timeline');
    expect(timeline).toHaveTextContent('users in 24s, apps in 1m 35s');
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Rate limits lift: users in 24s, apps in 1m 35s',
    );
  });

  it('places a mark for every armed gate', () => {
    render(
      <ResetTimeline
        buckets={[
          bucket({ bucket: '/api/v1/users', gatedUntil: NOW + 30_000 }),
          bucket({ bucket: '/api/v1/apps', gatedUntil: NOW + 60_000 }),
          bucket({ bucket: '/api/v1/groups' }),
        ]}
        now={NOW}
      />,
    );

    expect(screen.getByTestId('activity-reset-mark-/api/v1/users')).toHaveStyle({ left: '50%' });
    expect(screen.getByTestId('activity-reset-mark-/api/v1/apps')).toHaveStyle({ left: '100%' });
    expect(screen.queryByTestId('activity-reset-mark-/api/v1/groups')).not.toBeInTheDocument();
  });
});
