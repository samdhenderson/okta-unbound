/**
 * Tests for one lane of the activity bar's bucket rack.
 *
 * The subject is the lane's **geometry**, which is the thing an earlier build got
 * backwards: the track is the bucket's remaining rate-limit budget, not the shape
 * of the current work (ADR-0072). A lane that fills to 100% whenever anything is
 * running looks identical whether the quota is untouched or exhausted, so these
 * assert the widths directly rather than trusting that something got drawn.
 *
 * Widths are asserted through inline `style.width` on purpose. The headless story
 * runner loads no Tailwind, so a story cannot prove any of this — a class-based
 * fill would be invisible to every gate in the ladder. Inline styles are the one
 * form of geometry a jsdom test can actually see.
 *
 * The second subject is the negative: ADR-0070 retains a bucket's lane for ten
 * minutes after its work drains and retains **only the lane's existence**. So a
 * lane with no budget reading must draw no scale, and several cases here assert
 * that nothing was drawn rather than that something was.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BucketRow, { budgetDenominator, headroomPercent, laneWidths } from './BucketRow';
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

/** The rendered width of one drawn segment, as a fraction of the track. */
function widthOf(testId: string): string | undefined {
  return screen.queryByTestId(testId)?.style.width;
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

describe('budgetDenominator', () => {
  it('is the remaining budget, not the limit', () => {
    // The whole of ADR-0072 in one assertion. Scaling to `limit` would answer
    // "how much of the quota is gone"; the lane answers "will the queued work
    // fit in what is left", which is the question a reader can act on.
    expect(budgetDenominator(bucket({ bucket: '/api/v1/users', limit: 600, remaining: 150 }))).toBe(
      150,
    );
  });

  it('is null when Okta has not reported on the bucket', () => {
    expect(
      budgetDenominator(bucket({ bucket: '/api/v1/meta', limit: null, remaining: null })),
    ).toBe(null);
  });

  it('is null for an exhausted bucket rather than zero', () => {
    // Zero is not a denominator. Every width drawn against it would be Infinity,
    // and `Infinity` compares false against every clamp, so it would read as calm.
    expect(budgetDenominator(bucket({ bucket: '/api/v1/users', limit: 600, remaining: 0 }))).toBe(
      null,
    );
  });
});

describe('laneWidths', () => {
  it('scales running and queued against the remaining budget', () => {
    const widths = laneWidths(
      bucket({ bucket: '/api/v1/users', remaining: 100, active: 10, queued: 40 }),
      100,
    );

    expect(widths.running).toBe('10%');
    expect(widths.queued).toBe('40%');
  });

  it('folds planned work into the queued extension', () => {
    // Queued and planned are one dashed segment on the track and two words on
    // the label line: the track answers "how much is coming", the words answer
    // "how much of it is committed" (ADR-0060).
    const widths = laneWidths(
      bucket({ bucket: '/api/v1/users', remaining: 100, queued: 10, planned: 15 }),
      100,
    );

    expect(widths.queued).toBe('25%');
  });

  it('saturates rather than overflowing when the work exceeds the budget', () => {
    // The picture worth having: the declared work does not fit in what is left,
    // said before the cooldown says it. The pale tail must vanish entirely, and
    // the two segments must still sum to exactly the track.
    const widths = laneWidths(
      bucket({ bucket: '/api/v1/users', remaining: 50, active: 20, queued: 400 }),
      50,
    );

    expect(widths.running).toBe('40%');
    expect(widths.queued).toBe('60%');
  });

  it('gives the running segment the whole track when it alone exceeds the budget', () => {
    const widths = laneWidths(
      bucket({ bucket: '/api/v1/users', remaining: 2, active: 9, queued: 9 }),
      2,
    );

    expect(widths.running).toBe('100%');
    expect(widths.queued).toBe('0%');
  });
});

describe('BucketRow forms', () => {
  it('draws work against the budget, and states the same magnitudes in words', () => {
    render(
      <BucketRow
        bucket={bucket({ bucket: '/api/v1/groups', remaining: 100, active: 4, queued: 61 })}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    const row = screen.getByTestId('activity-bucket-/api/v1/groups');
    expect(row).toHaveAttribute('data-state', 'working');
    expect(widthOf('activity-bucket-running-/api/v1/groups')).toBe('4%');
    expect(widthOf('activity-bucket-queued-/api/v1/groups')).toBe('61%');
    // The lane is readable with the patterns ignored entirely.
    expect(row).toHaveTextContent('4 running · 61 queued');
  });

  it('draws no scale at all when the budget is unknown', () => {
    // ADR-0070 §6: the memory never resurrects a lapsed reading, and an
    // unobserved bucket has no denominator to draw against. The failure mode
    // being pinned is an invented one — a fill computed from work alone.
    render(
      <BucketRow
        bucket={bucket({
          bucket: '/api/v1/meta',
          limit: null,
          remaining: null,
          active: 2,
          queued: 8,
        })}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    const row = screen.getByTestId('activity-bucket-/api/v1/meta');
    expect(row).toHaveAttribute('data-state', 'unmeasured');
    expect(screen.queryByTestId('activity-bucket-running-/api/v1/meta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activity-bucket-queued-/api/v1/meta')).not.toBeInTheDocument();
    // The counts are real and are still stated; only the magnitude is withheld.
    expect(row).toHaveTextContent('2 running · 8 queued');
    expect(screen.getByTestId('activity-bucket-track-/api/v1/meta')).toHaveAccessibleName(
      /budget not reported/,
    );
  });

  it('draws nothing on a lane at rest', () => {
    render(
      <BucketRow
        bucket={bucket({ bucket: '/api/v1/users', lastActiveAt: NOW - 40_000 })}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    const row = screen.getByTestId('activity-bucket-/api/v1/users');
    expect(row).toHaveAttribute('data-state', 'at-rest');
    expect(screen.queryByTestId('activity-bucket-running-/api/v1/users')).not.toBeInTheDocument();
    expect(row).toHaveTextContent('at rest · 40s ago');
  });

  it('hatches the whole track while a gate is armed, and says so in words', () => {
    render(
      <BucketRow
        bucket={bucket({ bucket: '/api/v1/users', gatedUntil: NOW + 24_000, queued: 5 })}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    const row = screen.getByTestId('activity-bucket-/api/v1/users');
    expect(row).toHaveAttribute('data-gated', 'true');
    expect(row).toHaveAttribute('data-state', 'gated');
    expect(row).toHaveTextContent('cooling down · 24s');
    // A gated lane draws no work: the countdown is the only magnitude that means
    // anything until the gate lifts.
    expect(screen.queryByTestId('activity-bucket-running-/api/v1/users')).not.toBeInTheDocument();
  });

  it('drops the cooldown wording once the gate has lifted', () => {
    render(
      <BucketRow
        bucket={bucket({ bucket: '/api/v1/users', gatedUntil: NOW - 1 })}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    expect(screen.getByTestId('activity-bucket-/api/v1/users')).not.toHaveTextContent(
      'cooling down',
    );
  });

  it('shows minutes and seconds for a long gate', () => {
    render(
      <BucketRow
        bucket={bucket({ bucket: '/api/v1/users', gatedUntil: NOW + 95_000 })}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    expect(screen.getByTestId('activity-bucket-/api/v1/users')).toHaveTextContent(
      'cooling down · 1m 35s',
    );
  });

  it('marks low headroom with the word, not only the colour', () => {
    render(
      <BucketRow
        bucket={bucket({ bucket: '/api/v1/users', limit: 600, remaining: 30, planned: 500 })}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    const row = screen.getByTestId('activity-bucket-/api/v1/users');
    expect(row).toHaveAttribute('data-low', 'true');
    expect(screen.getByTestId('activity-bucket-low-/api/v1/users')).toHaveTextContent('low');
    expect(row).toHaveTextContent('500 planned');
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

/**
 * ADR-0070's load-bearing half. A remembered bucket keeps its lane after its
 * queue drains, its plan is reaped and its header observation expires — and what
 * is retained is the lane's *existence*, never a number. These assert the
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
    expect(row).toHaveTextContent('at rest · 2m ago');
  });

  it('shows no budget figure that could be mistaken for a live reading', () => {
    render(<BucketRow bucket={remembered} lowThresholdPercent={10} now={NOW} />);

    const row = screen.getByTestId('activity-bucket-/api/v1/users');
    // No `remaining/limit` pair anywhere in the lane, and no percentage — the
    // two shapes a stale reading would take. The lane now prints no budget
    // figure in *any* state; the exact numbers live on the track's accessible
    // name, where "not reported" is the honest answer here.
    expect(row.textContent).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(row.textContent).not.toMatch(/%/);
    // Nor any of the work counts, which are genuinely zero and are drawn as an
    // empty lane rather than printed as "0 running".
    expect(row).not.toHaveTextContent('running');
    expect(row).not.toHaveTextContent('queued');
    expect(row).not.toHaveTextContent('planned');
    expect(row).not.toHaveAttribute('data-low');
    expect(row).not.toHaveAttribute('data-gated');
  });

  it('never prints NaN when the timestamp is missing rather than null', () => {
    // The bug this pins: `lastActiveAt` is typed `number | null`, so the guard
    // was written `!== null` — but the value crosses the service-worker
    // boundary, and `undefined !== null` is `true`. That put `now - undefined`
    // into the age, and the lane read `NaNh ago`. A panel running ahead of a
    // worker that has not restarted yet produces exactly this, and so would any
    // future rename of the field.
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
    expect(row).not.toHaveTextContent('ago');
  });

  it('never prints NaN when the clock itself is unreadable', () => {
    // The other half. `Math.max(0, NaN)` is NaN, so `sinceLabel`'s clamp does
    // not stop a bad `now` on its own — every comparison after it is false and
    // it falls through to the hours branch.
    render(<BucketRow bucket={remembered} lowThresholdPercent={10} now={Number.NaN} />);

    expect(screen.getByTestId('activity-bucket-/api/v1/users').textContent).not.toMatch(/NaN/);
  });

  it('says only "at rest" when the worker was evicted and lastActiveAt is null', () => {
    // No timestamp is fabricated and none is persisted to survive eviction: the
    // activity a timestamp would describe did not survive it either.
    render(
      <BucketRow
        bucket={{ ...remembered, lastActiveAt: null }}
        lowThresholdPercent={10}
        now={NOW}
      />,
    );

    const row = screen.getByTestId('activity-bucket-/api/v1/users');
    expect(row).toHaveTextContent('at rest');
    expect(row).not.toHaveTextContent('ago');
  });
});
