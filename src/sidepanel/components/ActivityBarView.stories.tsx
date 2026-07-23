import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ActivityBarView from './ActivityBarView';
import type { ActivityView } from '../hooks/useActivityBar';
import { inSidePanelFrame } from '../../../.storybook/decorators';

/**
 * Pure presentation of the unified activity bar — a fixed bottom bar with a
 * stable layout (status, four metric slots, action area) driven entirely by
 * an already-merged `ActivityView`.
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
          'The status region, the four metric slots (queue / active / rate-limit / eta) and the action area stay mounted, so values coming and going swap text in place instead of reflowing the row. On a narrow panel the bar can collapse to a condensed line — status + rate + a processed/progress tally — behind a chevron toggle. All state arrives as an already-merged `ActivityView`; timers and context wiring live in `useActivityBar`.',
      },
    },
  },
  argTypes: {
    view: {
      description:
        'Merged, display-ready activity state (status, metric slots, progress, cancel flags).',
    },
    onCancel: { description: 'Invoked when the user confirms cancellation of the current work.' },
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
    onToggleCollapse: fn(),
  },
} satisfies Meta<typeof ActivityBarView>;

export default meta;
type Story = StoryObj<typeof meta>;

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
  processed: 0,
  failed: 0,
  isCancelling: false,
  canCancel: false,
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
      etaLabel: '~0:34 left',
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
      etaLabel: '~0:08 left',
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
      etaLabel: '~0:34 left',
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
