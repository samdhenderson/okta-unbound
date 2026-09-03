import type { Meta, StoryObj } from '@storybook/react-vite';
import BucketList from './BucketList';
import type { BucketState } from '@/shared/scheduler/types';

/**
 * The bucket **rack**: every Okta rate-limit family that has been exercised, as
 * parallel lanes of identical geometry.
 *
 * The lanes are identical on purpose. Okta meters per endpoint family, so the
 * question is always comparative — which family is the one holding everything
 * up? A column of differently-shaped cards cannot answer that; a rack answers it
 * by scanning down one column.
 */
const meta = {
  title: 'Sidepanel/Activity/BucketList',
  component: BucketList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The bucket rack of the expanded activity bar.\n\n' +
          'A lane is earned by **strain or by recent use**. The filter used to be strain alone, which was defensible only while the scheduler stopped emitting a bucket seconds after its work finished. ADR-0070 keeps a bucket for ten minutes after that, and a bucket stops being strained on its *last settle* — so a strained-only filter would delete the row at the exact instant the memory exists to preserve it.\n\n' +
          'What still collapses to one line is a family the scheduler is merely aware of and that has never settled a request in this worker’s lifetime. Overflow past the lane cap is **named** separately from the never-used set: calling a capped-out busy bucket "idle" would be the same class of error as letting a memory pass for a reading.',
      },
    },
  },
  argTypes: {
    buckets: { description: 'Buckets as published by the scheduler, most-pressured first.' },
    lowThresholdPercent: {
      description:
        'The org-learned percentage at which the scheduler backs off. Lanes mark "low" at the line the scheduler acts on, not one of their own.',
    },
    now: { description: 'Shared clock tick in epoch ms, so every countdown in the bar agrees.' },
    maxRows: { description: 'Cap on lanes. Overflow is named in the summary line, never dropped.' },
  },
} satisfies Meta<typeof BucketList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Frozen so countdowns and ages do not drift between runs. */
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

/** Nothing has been exercised: every family collapses to one grey line. */
export const NothingExercised: Story = {
  args: {
    buckets: [
      bucket({ bucket: '/api/v1/users' }),
      bucket({ bucket: '/api/v1/groups' }),
      bucket({ bucket: '/api/v1/policies' }),
    ],
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/** A walk under way: three families working in parallel, which is what the rack is for. */
export const WorkInParallel: Story = {
  args: {
    buckets: [
      bucket({
        bucket: '/api/v1/users',
        remaining: 288,
        active: 4,
        queued: 26,
        planned: 470,
        lastActiveAt: NOW - 400,
      }),
      bucket({
        bucket: '/api/v1/groups',
        remaining: 512,
        active: 3,
        queued: 8,
        lastActiveAt: NOW - 900,
      }),
      bucket({ bucket: '/api/v1/apps', limit: 300, remaining: 24, active: 1, lastActiveAt: NOW }),
      bucket({ bucket: '/api/v1/policies' }),
    ],
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/**
 * A minute after the walk. The lanes survive — that is ADR-0070 — but they are
 * empty, say **at rest**, and carry no budget figure. The one number is an age,
 * and it is labelled as one.
 */
export const RememberedAtRest: Story = {
  args: {
    buckets: [
      bucket({
        bucket: '/api/v1/users',
        limit: null,
        remaining: null,
        resetAt: null,
        lastActiveAt: NOW - 95_000,
      }),
      bucket({
        bucket: '/api/v1/groups',
        limit: null,
        remaining: null,
        resetAt: null,
        lastActiveAt: NOW - 8_000,
      }),
      bucket({ bucket: '/api/v1/policies' }),
    ],
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/** One family gated: the lane is hatched and carries its own countdown, not the global one. */
export const OneFamilyGated: Story = {
  args: {
    buckets: [
      bucket({
        bucket: '/api/v1/users',
        remaining: 18,
        queued: 40,
        planned: 500,
        gatedUntil: NOW + 24_000,
        lastActiveAt: NOW - 1_000,
      }),
      bucket({
        bucket: '/api/v1/groups',
        remaining: 540,
        active: 4,
        lastActiveAt: NOW - 200,
      }),
      bucket({ bucket: '/api/v1/meta', limit: null, remaining: null, resetAt: null }),
    ],
    lowThresholdPercent: 10,
    now: NOW,
  },
};

/** Past the cap: the lanes that lost their seat are named, and never called idle. */
export const OverflowNamed: Story = {
  args: {
    buckets: [
      bucket({ bucket: '/api/v1/users', queued: 5, lastActiveAt: NOW - 100 }),
      bucket({ bucket: '/api/v1/groups', queued: 4, lastActiveAt: NOW - 200 }),
      bucket({ bucket: '/api/v1/apps', queued: 3, lastActiveAt: NOW - 300 }),
      bucket({ bucket: '/api/v1/zones', queued: 2, lastActiveAt: NOW - 400 }),
      bucket({ bucket: '/api/v1/idps' }),
    ],
    lowThresholdPercent: 10,
    now: NOW,
    maxRows: 2,
  },
};
