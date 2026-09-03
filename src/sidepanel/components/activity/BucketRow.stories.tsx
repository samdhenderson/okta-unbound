import type { Meta, StoryObj } from '@storybook/react-vite';
import BucketRow from './BucketRow';
import type { BucketState } from '@/shared/scheduler/types';

/**
 * One lane of the activity bar's bucket **rack**.
 *
 * Okta enforces quotas per endpoint family, so `/api/v1/apps` can be exhausted
 * while `/api/v1/groups` sits untouched (ADR-0059). Every family gets the same
 * lane geometry — a label line naming the family and its counts, above a
 * full-width track drawn against that family's *remaining* budget — so the rack
 * stays scannable down its columns.
 */
const meta = {
  title: 'Sidepanel/Activity/BucketRow',
  component: BucketRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One lane of the bucket rack.\n\n' +
          '**The track is the budget, not the shape of the work** (ADR-0072). Its denominator is `remaining`: running requests fill from the left in solid indigo, queued and planned work continues as a dashed extension, and the pale tail is the headroom that will still be there once this work drains. When the declared work exceeds the remaining budget the track saturates and the tail disappears — which says *this will not fit*, before the cooldown says it for you. The fill used to be a share of the current work instead, which meant the track read 100% full whether four requests were running against an untouched quota or four hundred against an exhausted one.\n\n' +
          'No lane prints a `remaining/limit` pair. The exact figures are on the track’s accessible name, where they inform without competing with the shape the track exists to show.\n\n' +
          'A gated lane is **hatched** and says `cooling down · 24s`; a low lane carries a literal `low` badge; queued work is separated from running work by pattern *axis* rather than by tint. Nothing depends on hue, every magnitude drawn is also stated in words, and every pattern is static — there is no motion to suppress under `prefers-reduced-motion`.\n\n' +
          'Two of the four forms draw **no scale at all**. A bucket the scheduler is *remembering* (ADR-0070) draws an empty track and says **at rest**; a bucket Okta has not reported on draws a faint hatch and says only its counts. What is retained after a bucket’s work drains is the lane’s existence, never a number — so a memory can never pass for a reading, and a lane with no denominator never invents one. With `lastActiveAt` at `null` the worker was evicted, and the lane says "at rest" and nothing more rather than fabricating a timestamp.',
      },
    },
  },
  argTypes: {
    bucket: { description: 'The bucket state as published by the scheduler.' },
    lowThresholdPercent: {
      description:
        'The org-learned percentage at which the scheduler backs off. Passed in so the row colours at the line the scheduler acts on, not one of its own.',
    },
    now: { description: 'Shared clock tick in epoch ms, so every countdown in the bar agrees.' },
  },
} satisfies Meta<typeof BucketRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Frozen so countdown stories do not drift between runs. */
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

/** Full headroom, nothing happening. */
export const Healthy: Story = {
  args: {
    bucket: bucket({ bucket: '/api/v1/groups' }),
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/** Work declared but not yet enqueued, drawn as a dashed claim on the remaining budget (ADR-0060). */
export const PlannedWork: Story = {
  args: {
    bucket: bucket({ bucket: '/api/v1/users', remaining: 380, planned: 812 }),
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/** Running, queued and planned at once — solid, then dashed, then the pale tail. */
export const FullPipeline: Story = {
  args: {
    bucket: bucket({
      bucket: '/api/v1/users',
      remaining: 288,
      active: 4,
      queued: 26,
      planned: 300,
    }),
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/** Below the org's warning threshold — the row colours at the scheduler's line. */
export const LowHeadroom: Story = {
  args: {
    bucket: bucket({ bucket: '/api/v1/apps', limit: 300, remaining: 27, queued: 12, planned: 96 }),
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/** Gated: the countdown is to the moment this bucket's own gate lifts. */
export const Cooling: Story = {
  args: {
    bucket: bucket({
      bucket: '/api/v1/users',
      limit: 600,
      remaining: 18,
      queued: 40,
      planned: 500,
      gatedUntil: NOW + 24_000,
    }),
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/**
 * The picture the redesign exists to produce: 240 requests queued against 60
 * remaining. The track saturates, the pale tail is gone, and the lane says the
 * work will not fit before the cooldown does.
 */
export const WorkExceedsBudget: Story = {
  args: {
    bucket: bucket({ bucket: '/api/v1/users', limit: 600, remaining: 60, active: 4, queued: 240 }),
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/**
 * Remembered after its work drained: an empty lane, the words **at rest**, an
 * age in words, and no budget figure.
 */
export const AtRest: Story = {
  args: {
    bucket: bucket({
      bucket: '/api/v1/users',
      limit: null,
      remaining: null,
      resetAt: null,
      lastActiveAt: NOW - 125_000,
    }),
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/**
 * The same lane after a service-worker eviction. `lastActiveAt` is `null`, so
 * there is no timestamp to show and none is fabricated — the activity a
 * timestamp would describe did not survive the suspension either.
 */
export const AtRestWorkerEvicted: Story = {
  args: {
    bucket: bucket({
      bucket: '/api/v1/users',
      limit: null,
      remaining: null,
      resetAt: null,
    }),
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/**
 * Okta has sent no headers for this family, so there is no denominator and the
 * track draws no scale — a faint hatch, and the counts in words. Unknown, not
 * empty and not exhausted.
 */
export const NotReported: Story = {
  args: {
    bucket: bucket({
      bucket: '/api/v1/meta',
      limit: null,
      remaining: null,
      resetAt: null,
      planned: 2,
    }),
    lowThresholdPercent: 10,
    now: NOW,
  },
};
