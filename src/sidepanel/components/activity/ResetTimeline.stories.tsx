import type { Meta, StoryObj } from '@storybook/react-vite';
import ResetTimeline from './ResetTimeline';
import type { BucketState } from '@/shared/scheduler/types';

/**
 * When each cooling-down bucket comes back, on one axis.
 *
 * A list of separate countdowns says when each gate lifts but not in what order,
 * and the order is the useful part: "users is back in twenty seconds, apps not
 * for two minutes" is what tells someone whether to wait.
 */
const meta = {
  title: 'Sidepanel/Activity/ResetTimeline',
  component: ResetTimeline,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The reset timeline, shown **only while a gate is armed**.\n\n' +
          'Each cooling-down bucket gets a mark on a shared axis, so their return order is a glance rather than a subtraction. The axis is at least sixty seconds wide, so a single short gate does not fill it and marks do not jump around as the furthest one ticks down. With nothing gated the component renders nothing at all — an idle bar must stay exactly as tall as it is (ADR-0008).',
      },
    },
  },
  argTypes: {
    buckets: { description: 'Buckets as published by the scheduler.' },
    now: { description: 'Shared clock tick in epoch ms, so the whole bar agrees on the time.' },
  },
} satisfies Meta<typeof ResetTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Frozen so the marks do not drift between runs. */
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

/** One bucket cooling down, on the minimum axis. */
export const SingleGate: Story = {
  args: {
    buckets: [bucket({ bucket: '/api/v1/users', remaining: 12, gatedUntil: NOW + 24_000 })],
    now: NOW,
  },
};

/** Three at once — the ordering the component exists for. */
export const StaggeredGates: Story = {
  args: {
    buckets: [
      bucket({ bucket: '/api/v1/apps', remaining: 4, gatedUntil: NOW + 95_000 }),
      bucket({ bucket: '/api/v1/users', remaining: 9, gatedUntil: NOW + 18_000 }),
      bucket({ bucket: '/api/v1/groups', remaining: 21, gatedUntil: NOW + 47_000 }),
      bucket({ bucket: '/api/v1/policies' }),
    ],
    now: NOW,
  },
};

/** A long gate widens the axis past a minute rather than clipping. */
export const LongCooldown: Story = {
  args: {
    buckets: [bucket({ bucket: '/api/v1/apps', remaining: 0, gatedUntil: NOW + 240_000 })],
    now: NOW,
  },
};
