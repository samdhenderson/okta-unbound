import type { Meta, StoryObj } from '@storybook/react-vite';
import ActivitySummary from './ActivitySummary';
import type { ActivityView } from '../../hooks/useActivityBar';

/**
 * The activity bar's one summary line — queue depth, rate-limit headroom, and
 * the time-remaining range.
 *
 * It replaces four boxed metric tiles. **Active** did not survive the collapse:
 * an in-flight count changes several times a second, no decision depends on it,
 * and the rack below already draws it as the filled part of every lane.
 */
const meta = {
  title: 'Sidepanel/Activity/ActivitySummary',
  component: ActivitySummary,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The activity bar’s summary line.\n\n' +
          'Every slot stays mounted whether or not it has a value, printing an em dash when it does not, so a value arriving never adds DOM and never reflows the row (ADR-0008).\n\n' +
          'The ETA slot shows the operation’s remaining-time **range** while one runs, and the global cooldown countdown (as **Resuming**) when one does not. Its unknown form is the word *estimating…* — never a number, because a made-up optimistic figure is exactly the failure the range replaced.',
      },
    },
  },
  argTypes: {
    view: {
      description:
        'Merged, display-ready activity state. Only `queueLength`, `rateLimit`, `eta`, `operationActive` and `cooldownLabel` are read.',
    },
  },
} satisfies Meta<typeof ActivitySummary>;

export default meta;
type Story = StoryObj<typeof meta>;

const base: ActivityView = {
  statusLabel: 'Ready',
  statusColorVar: 'var(--color-success)',
  busy: false,
  operationActive: false,
  current: 0,
  total: 0,
  percentage: 0,
  eta: null,
  opCompleted: 0,
  opActive: 0,
  opFailed: 0,
  queueLength: 0,
  activeRequests: 0,
  rateLimit: null,
  processed: 0,
  failed: 0,
  isCancelling: false,
  canCancel: false,
  buckets: [],
  lowThresholdPercent: 10,
  operations: [],
  now: 1_760_000_000_000,
};

/** Nothing to report. Every slot holds its place with an em dash. */
export const Empty: Story = { args: { view: base } };

/** Idle with headroom known — the common resting shape. */
export const Idle: Story = {
  args: { view: { ...base, rateLimit: { remaining: 540, limit: 600, low: false } } },
};

/** Running, with throughput measured and no gate armed: a single figure. */
export const PointEstimate: Story = {
  args: {
    view: {
      ...base,
      operationActive: true,
      queueLength: 26,
      rateLimit: { remaining: 288, limit: 600, low: false },
      eta: { kind: 'point', lowerMs: 34_000, label: '~0:34 left' },
    },
  },
};

/** Running with a gate armed: the ceiling carries the cooldown the user will sit out. */
export const RangeWidenedByCooldown: Story = {
  args: {
    view: {
      ...base,
      operationActive: true,
      queueLength: 40,
      rateLimit: { remaining: 18, limit: 600, low: true },
      eta: { kind: 'range', lowerMs: 80_000, upperMs: 170_000, label: '1:20–2:50 left' },
    },
  },
};

/** Too few samples to extrapolate. Words, not an optimistic number. */
export const NotKnownYet: Story = {
  args: {
    view: {
      ...base,
      operationActive: true,
      queueLength: 30,
      rateLimit: { remaining: 594, limit: 600, low: false },
      eta: { kind: 'unknown', label: 'estimating…' },
    },
  },
};

/** No operation, but the scheduler is cooling down: the slot becomes **Resuming**. */
export const Resuming: Story = {
  args: {
    view: {
      ...base,
      rateLimit: { remaining: 12, limit: 600, low: true },
      cooldownLabel: '24s',
    },
  },
};
