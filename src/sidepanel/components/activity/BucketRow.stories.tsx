import type { Meta, StoryObj } from '@storybook/react-vite';
import BucketRow from './BucketRow';
import type { BucketState } from '@/shared/scheduler/types';

/**
 * One lane of the activity bar's bucket **rack**.
 *
 * Okta enforces quotas per endpoint family, so `/api/v1/apps` can be exhausted
 * while `/api/v1/groups` sits untouched (ADR-0059). Every family gets the same
 * lane geometry, and its state is folded *onto* the lane rather than sitting
 * beside it, so the rack stays scannable down its columns.
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
          'Headroom is rendered as `remaining/limit`, or **not reported** when Okta has said nothing about the bucket — unknown is deliberately not shown as exhausted. The lane fill splits the bucket’s work into in-flight, queued, and planned, so declared-but-unspent requests are visible before they are made (ADR-0060).\n\n' +
          'A gated lane is **hatched** and carries its own countdown; a low lane carries a literal `low` chip. Neither depends on hue, and the hatch is static — there is no motion to suppress under `prefers-reduced-motion`.\n\n' +
          'A bucket the scheduler is *remembering* (ADR-0070) draws an empty lane, says **at rest**, and prints no budget figure at all. What is retained after a bucket’s work drains is the lane’s existence, never a number — so a memory can never pass for a reading. With `lastActiveAt` at `null`, the worker was evicted and the lane says "at rest" and nothing more rather than inventing a timestamp.',
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

/** Work declared but not yet enqueued — the state the scheduler could not show before. */
export const PlannedWork: Story = {
  args: {
    bucket: bucket({ bucket: '/api/v1/users', remaining: 380, planned: 812 }),
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/** In flight, queued, and planned all at once. */
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

/** Okta has sent no headers for this family. Unknown, not empty. */
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
