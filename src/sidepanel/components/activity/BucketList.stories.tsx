import type { Meta, StoryObj } from '@storybook/react-vite';
import BucketList from './BucketList';
import type { BucketState } from '@/shared/scheduler/types';

/**
 * The bucket **rack**: every Okta rate-limit family the scheduler is tracking,
 * as parallel lanes of identical geometry, keyed by one legend.
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
          '**Every published bucket gets a lane** (ADR-0072). The rack used to filter — first to buckets under strain, then to strain *or* recent use, with the remainder collapsed onto a "3 buckets idle · meta, zones" line. Both filters answered a second, differently-shaped question from the one the scheduler had already answered, and the two disagreed at exactly the wrong moment: a bucket stops being strained on its *last settle*, so a strain filter deleted the row at the instant ADR-0070’s memory existed to preserve it.\n\n' +
          'So there is no filter, no row cap and no summary line. A lane appears when the scheduler starts tracking a bucket and disappears when the scheduler forgets it, on one clock, decided in one place — bounded at twelve with LRU eviction by ADR-0070 §5. The rack renders retention; it has no retention policy of its own.\n\n' +
          'Height is bounded by **scrolling, not truncating**: every lane stays reachable, and none is hidden behind prose a reader has to expand something to resolve. Truncating would reintroduce the filter one layer down.',
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

/**
 * Seven families at once — the case the old lane cap truncated at six and named
 * in prose. Every one keeps its lane; the rack scrolls rather than summarising.
 */
export const EveryBucketKeepsItsLane: Story = {
  args: {
    buckets: [
      bucket({ bucket: '/api/v1/users', limit: 600, remaining: 90, active: 4, queued: 120 }),
      bucket({ bucket: '/api/v1/groups', limit: 600, remaining: 410, active: 2, queued: 18 }),
      bucket({ bucket: '/api/v1/apps', limit: 300, remaining: 22, gatedUntil: NOW + 24_000 }),
      bucket({ bucket: '/api/v1/zones', queued: 2, lastActiveAt: NOW - 400 }),
      bucket({ bucket: '/api/v1/policies', lastActiveAt: NOW - 40_000 }),
      bucket({ bucket: '/api/v1/meta', limit: null, remaining: null, resetAt: null, active: 1 }),
      bucket({ bucket: '/api/v1/idps' }),
    ],
    lowThresholdPercent: 10,
    now: NOW,
  },
};
