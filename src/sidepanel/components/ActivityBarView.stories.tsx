import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ActivityBarView from './ActivityBarView';
import type { ActivityView } from '../hooks/useActivityBar';
import { inSidePanelFrame } from '../../../.storybook/decorators';

/**
 * Pure presentation of the unified activity bar — a fixed bottom bar with a
 * stable layout (status, a one-line summary, action area) driven entirely by
 * an already-merged `ActivityView`, with the bucket rack beneath it.
 */
const meta = {
  title: 'Sidepanel/ActivityBarView',
  component: ActivityBarView,
  tags: ['autodocs'],
  // `position: fixed` bottom bar — frame it so every state renders in view here
  // and in autodocs rather than pinned to the bottom of a blank page.
  decorators: [inSidePanelFrame],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Pure presentation of the unified activity bar — a fixed bottom bar with a deliberately stable layout.\n\n' +
          'The status region, the one-line summary (queue · rate · ETA) and the action area stay mounted, so values coming and going swap text in place instead of reflowing the row. Four boxed metric tiles used to sit where the summary line is; **Active** is gone from them entirely, because the in-flight count changes several times a second and the bucket rack below already draws it.\n\n' +
          'Beneath the row sits the rack: one lane per rate-limit family that has been exercised, with badges and cooldown hatching folded onto the lane. On a narrow panel the bar collapses to a condensed line — status + rate + a processed/progress tally, and **no bars at all** — behind a chevron toggle. All state arrives as an already-merged `ActivityView`; timers and context wiring live in `useActivityBar`.',
      },
    },
  },
  argTypes: {
    view: {
      description:
        'Merged, display-ready activity state (status, summary figures, the ETA range, buckets, progress, cancel flags).',
    },
    onCancel: { description: 'Invoked when the user confirms cancellation of the current work.' },
    onCancelOperation: {
      description: 'Stops one declared operation, leaving every other one running.',
    },
    collapsible: {
      description:
        'Whether the panel is narrow enough to offer collapsing; when `true` the chevron toggle is shown.',
    },
    collapsed: {
      description:
        'Whether the bar is currently condensed to its essentials. Only meaningful when `collapsible`.',
    },
    onToggleCollapse: { description: 'Toggles between the condensed and full layouts.' },
  },
  args: {
    onCancel: fn(),
    onCancelOperation: fn(),
    onToggleCollapse: fn(),
  },
} satisfies Meta<typeof ActivityBarView>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A frozen clock. Countdowns are derived from `now`, so a real one would make
 * every story a moving target for the visual-diff run.
 */
const FIXED_NOW = 1_760_000_000_000;

const idleView: ActivityView = {
  statusLabel: 'Ready',
  statusColorVar: 'var(--color-success)',
  busy: false,
  operationActive: false,
  current: 0,
  total: 0,
  percentage: 0,
  opCompleted: 0,
  opActive: 0,
  opFailed: 0,
  queueLength: 0,
  activeRequests: 0,
  rateLimit: null,
  eta: null,
  processed: 0,
  failed: 0,
  isCancelling: false,
  canCancel: false,
  buckets: [],
  lowThresholdPercent: 10,
  operations: [],
  now: FIXED_NOW,
};

/** Fully idle — nothing queued, nothing processed, cancel disabled. */
export const Default: Story = {
  args: { view: idleView },
};

/** A named batch operation in progress with the full breakdown row. */
export const OperationInProgress: Story = {
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Removing members',
      current: 42,
      total: 120,
      percentage: 35,
      elapsedLabel: '0:18',
      eta: { kind: 'point', lowerMs: 34_000, label: '~0:34 left' },
      opCompleted: 40,
      opActive: 2,
      opFailed: 0,
      queueLength: 6,
      activeRequests: 2,
      canCancel: true,
    },
  },
};

/** A running operation with some failed items in the batch breakdown. */
export const OperationWithFailures: Story = {
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Adding members',
      current: 88,
      total: 100,
      percentage: 88,
      elapsedLabel: '1:02',
      eta: { kind: 'point', lowerMs: 8_000, label: '~0:08 left' },
      opCompleted: 82,
      opActive: 1,
      opFailed: 5,
      queueLength: 1,
      activeRequests: 1,
      canCancel: true,
    },
  },
};

/** Scheduler is rate-limit throttled with headroom below the 20% warning line. */
export const RateLimitLow: Story = {
  args: {
    view: {
      ...idleView,
      statusLabel: 'Throttled',
      statusColorVar: 'var(--color-warning)',
      busy: true,
      queueLength: 14,
      activeRequests: 3,
      rateLimit: { remaining: 8, limit: 100, low: true },
      canCancel: true,
    },
  },
};

/** Scheduler is in a cooldown window, counting down to resume. */
export const Cooldown: Story = {
  args: {
    view: {
      ...idleView,
      statusLabel: 'Cooldown',
      statusColorVar: 'var(--color-danger)',
      busy: true,
      queueLength: 9,
      cooldownLabel: '12s',
      canCancel: true,
    },
  },
};

/** Idle after a completed run, showing the processed tally with failures. */
export const ProcessedWithFailures: Story = {
  args: {
    view: {
      ...idleView,
      processed: 118,
      failed: 3,
    },
  },
};

/**
 * Narrow panel, condensed to essentials — status, rate and the processed tally,
 * with a chevron to reveal the rest. This is the idle small-screen default.
 */
export const CollapsedIdle: Story = {
  args: {
    collapsible: true,
    collapsed: true,
    view: {
      ...idleView,
      rateLimit: { remaining: 480, limit: 600, low: false },
      processed: 118,
      failed: 3,
    },
  },
};

/** Narrow panel, condensed, with an operation running — progress shows in place of the tally. */
export const CollapsedOperation: Story = {
  args: {
    collapsible: true,
    collapsed: true,
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Removing members',
      current: 42,
      total: 120,
      percentage: 35,
      opCompleted: 40,
      opActive: 2,
      opFailed: 1,
      rateLimit: { remaining: 90, limit: 600, low: false },
      queueLength: 6,
      activeRequests: 2,
      canCancel: true,
    },
  },
};

/** Narrow panel with the user expanded — the full stats show and wrap onto multiple lines. */
export const NarrowExpanded: Story = {
  args: {
    collapsible: true,
    collapsed: false,
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Removing members',
      current: 42,
      total: 120,
      percentage: 35,
      elapsedLabel: '0:18',
      eta: { kind: 'point', lowerMs: 34_000, label: '~0:34 left' },
      opCompleted: 40,
      opActive: 2,
      opFailed: 0,
      rateLimit: { remaining: 90, limit: 600, low: false },
      queueLength: 6,
      activeRequests: 2,
      canCancel: true,
    },
  },
};

/** Cancel confirmed and unwinding — the button reads "Cancelling…" and disables. */
export const Cancelling: Story = {
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Removing members',
      current: 10,
      total: 50,
      percentage: 20,
      opCompleted: 10,
      opActive: 0,
      opFailed: 0,
      queueLength: 3,
      isCancelling: true,
      canCancel: false,
    },
  },
};

/**
 * Helper for bucket fixtures below. `resetAt` is fixed so nothing drifts between
 * story runs.
 */
function bucket(
  overrides: { bucket: string } & Partial<ActivityView['buckets'][number]>,
): ActivityView['buckets'][number] {
  return {
    limit: 600,
    remaining: 600,
    resetAt: FIXED_NOW + 60_000,
    queued: 0,
    active: 0,
    planned: 0,
    gatedUntil: null,
    lastActiveAt: null,
    ...overrides,
  };
}

/**
 * Idle, but the scheduler has seen five families. Every one is at full headroom,
 * so all five collapse to a single grey line and the bar stays as slim as it is
 * with no buckets at all.
 */
export const BucketsAllQuiet: Story = {
  args: {
    view: {
      ...idleView,
      processed: 128,
      buckets: [
        bucket({ bucket: '/api/v1/users' }),
        bucket({ bucket: '/api/v1/groups' }),
        bucket({ bucket: '/api/v1/apps' }),
        bucket({ bucket: '/api/v1/policies' }),
        bucket({ bucket: '/api/v1/meta', limit: null, remaining: null, resetAt: null }),
      ],
    },
  },
};

/**
 * An export under way: `/api/v1/users` has 812 requests declared against it
 * before most of them exist, while the untouched families stay collapsed.
 */
export const BucketsWithPlannedWork: Story = {
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Export all users',
      current: 312,
      total: 812,
      percentage: 38,
      opCompleted: 312,
      opActive: 4,
      queueLength: 26,
      activeRequests: 4,
      rateLimit: { remaining: 288, limit: 600, low: false },
      canCancel: true,
      buckets: [
        bucket({ bucket: '/api/v1/users', remaining: 288, active: 4, queued: 26, planned: 470 }),
        bucket({ bucket: '/api/v1/groups' }),
        bucket({ bucket: '/api/v1/policies' }),
      ],
    },
  },
};

/**
 * One family exhausted and cooling, the rest untouched — the case per-bucket
 * gating exists for (ADR-0059). The countdown is that bucket's own gate.
 */
export const BucketCoolingDown: Story = {
  args: {
    view: {
      ...idleView,
      statusLabel: 'Cooldown',
      statusColorVar: 'var(--color-danger)',
      busy: true,
      queueLength: 40,
      rateLimit: { remaining: 18, limit: 600, low: true },
      cooldownLabel: '24s',
      canCancel: true,
      buckets: [
        bucket({
          bucket: '/api/v1/users',
          remaining: 18,
          queued: 40,
          planned: 500,
          gatedUntil: FIXED_NOW + 24_000,
        }),
        bucket({ bucket: '/api/v1/apps', limit: 300, remaining: 81, queued: 3, planned: 402 }),
        bucket({ bucket: '/api/v1/groups' }),
        bucket({ bucket: '/api/v1/policies' }),
      ],
    },
  },
};

/**
 * The rack a minute after a walk finished. `/api/v1/users` and `/api/v1/groups`
 * kept their lanes because the scheduler remembers a bucket for ten minutes
 * after its work drains (ADR-0070) — and they say **at rest** with an empty
 * lane and no budget figure, because what is retained is the lane's existence,
 * never a number.
 *
 * `/api/v1/apps` also has a lane and no timestamp: the service worker was
 * evicted, so `lastActiveAt` is `null`. It says "at rest" and nothing more
 * rather than inventing a time. `/api/v1/policies` never settled anything and
 * collapses to the summary line.
 */
export const RackAtRest: Story = {
  args: {
    view: {
      ...idleView,
      processed: 1_284,
      buckets: [
        bucket({
          bucket: '/api/v1/users',
          limit: null,
          remaining: null,
          resetAt: null,
          lastActiveAt: FIXED_NOW - 95_000,
        }),
        bucket({
          bucket: '/api/v1/groups',
          limit: null,
          remaining: null,
          resetAt: null,
          lastActiveAt: FIXED_NOW - 6_000,
        }),
        bucket({ bucket: '/api/v1/apps', limit: null, remaining: null, resetAt: null }),
        bucket({ bucket: '/api/v1/policies' }),
      ],
    },
  },
};

/**
 * A run with no throughput sample yet: three items settled is the floor, and
 * below it the ETA slot says **estimating…** rather than a number. "Does not
 * know" has to look different from "fast" — an optimistic figure here is the
 * lie the range exists to remove.
 */
export const EtaNotKnownYet: Story = {
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Export all users',
      current: 1,
      total: 812,
      percentage: 0,
      opCompleted: 1,
      opActive: 4,
      queueLength: 30,
      activeRequests: 4,
      rateLimit: { remaining: 594, limit: 600, low: false },
      eta: { kind: 'unknown', label: 'estimating…' },
      canCancel: true,
      buckets: [
        bucket({
          bucket: '/api/v1/users',
          remaining: 594,
          active: 4,
          queued: 30,
          planned: 778,
          lastActiveAt: FIXED_NOW - 1_000,
        }),
      ],
    },
  },
};

/**
 * The same run once throughput is measurable *and* a gate is armed. The floor is
 * what throughput alone predicts; the ceiling adds the longest armed gate, so
 * the cooldown the user is about to sit out is inside the number rather than
 * contradicting it thirty seconds later.
 */
export const EtaRangeWidenedByCooldown: Story = {
  args: {
    view: {
      ...idleView,
      statusLabel: 'Cooldown',
      statusColorVar: 'var(--color-danger)',
      busy: true,
      operationActive: true,
      operationName: 'Export all users',
      current: 406,
      total: 812,
      percentage: 50,
      opCompleted: 402,
      opActive: 4,
      opFailed: 4,
      queueLength: 40,
      activeRequests: 4,
      rateLimit: { remaining: 18, limit: 600, low: true },
      eta: { kind: 'range', lowerMs: 80_000, upperMs: 170_000, label: '1:20–2:50 left' },
      canCancel: true,
      buckets: [
        bucket({
          bucket: '/api/v1/users',
          remaining: 18,
          queued: 40,
          planned: 366,
          gatedUntil: FIXED_NOW + 90_000,
          lastActiveAt: FIXED_NOW - 2_000,
        }),
        bucket({
          bucket: '/api/v1/groups',
          limit: 600,
          remaining: 540,
          active: 4,
          lastActiveAt: FIXED_NOW - 500,
        }),
      ],
    },
  },
};

function leg(bucket: string, estimated: number | null, spent = 0) {
  return {
    id: `${bucket}-leg`,
    bucket,
    method: 'GET',
    estimated,
    spent,
    remaining: estimated === null ? null : Math.max(0, estimated - spent),
    approximate: false,
  };
}

/**
 * Two operations at once — the case the single progress bar above cannot
 * express. Each row carries its own stop control; the queue-wide button becomes
 * "Cancel all", because with two ✕s already on screen a bare "Cancel" no longer
 * says which.
 */
export const ConcurrentOperations: Story = {
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Export all users',
      current: 312,
      total: 812,
      percentage: 38,
      opCompleted: 312,
      opActive: 4,
      queueLength: 26,
      activeRequests: 4,
      rateLimit: { remaining: 288, limit: 600, low: false },
      canCancel: true,
      buckets: [
        bucket({ bucket: '/api/v1/users', remaining: 288, active: 4, queued: 26, planned: 470 }),
        bucket({ bucket: '/api/v1/groups', active: 1, planned: 2 }),
      ],
      operations: [
        {
          id: 'export',
          name: 'Export all users',
          startedAt: FIXED_NOW - 90_000,
          legs: [leg('/api/v1/users', 812, 342)],
          spent: 342,
          estimated: 812,
          remaining: 470,
          approximate: false,
        },
        {
          id: 'search',
          name: 'Search groups',
          startedAt: FIXED_NOW - 2_000,
          legs: [leg('/api/v1/groups', 3, 1)],
          spent: 1,
          estimated: 3,
          remaining: 2,
          approximate: true,
        },
      ],
    },
  },
};

/**
 * Gated, with the ledger above and the reset timeline between: what is still
 * owed, and when each family comes back to pay it.
 */
export const GatedWithLedger: Story = {
  args: {
    view: {
      ...idleView,
      statusLabel: 'Cooldown',
      statusColorVar: 'var(--color-danger)',
      busy: true,
      queueLength: 40,
      rateLimit: { remaining: 18, limit: 600, low: true },
      cooldownLabel: '24s',
      canCancel: true,
      buckets: [
        bucket({
          bucket: '/api/v1/users',
          remaining: 18,
          queued: 40,
          planned: 470,
          gatedUntil: FIXED_NOW + 24_000,
        }),
        bucket({
          bucket: '/api/v1/apps',
          limit: 300,
          remaining: 4,
          queued: 3,
          planned: 402,
          gatedUntil: FIXED_NOW + 95_000,
        }),
        bucket({ bucket: '/api/v1/groups' }),
      ],
      operations: [
        {
          id: 'export',
          name: 'Export all users',
          startedAt: FIXED_NOW - 90_000,
          legs: [leg('/api/v1/users', 812, 342)],
          spent: 342,
          estimated: 812,
          remaining: 470,
          approximate: false,
        },
        {
          id: 'assignments',
          name: 'Count app assignments',
          startedAt: FIXED_NOW - 30_000,
          legs: [leg('/api/v1/apps', 402, 0)],
          spent: 0,
          estimated: 402,
          remaining: 402,
          approximate: true,
        },
      ],
    },
  },
};
