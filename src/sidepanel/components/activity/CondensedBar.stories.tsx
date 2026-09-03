import type { Meta, StoryObj } from '@storybook/react-vite';
import CondensedBar from './CondensedBar';
import { Button } from '../shared';
import type { ActivityView } from '../../hooks/useActivityBar';

/**
 * The activity bar's condensed line, for a panel too narrow to fit the full row.
 *
 * Status, rate-limit headroom, a processed/progress tally — and **no bars**. The
 * rack is expanded-only rather than shrunk: a lane at this width is a few pixels
 * of colour that can be read as anything, and the rack is the one section of the
 * bar whose height grows with what the org has been doing.
 */
const meta = {
  title: 'Sidepanel/Activity/CondensedBar',
  component: CondensedBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The condensed activity line.\n\n' +
          'This is a **separate tree** from the full layout, swapped rather than cross-faded (ADR-0008). A crossfade would need both trees mounted at once, duplicating the Cancel control and the bar’s `role="status"` live region in the tab order, and their differing heights would move the bar’s top edge — the exact reflow the ADR forbids.',
      },
    },
  },
  argTypes: {
    view: { description: 'Merged, display-ready activity state.' },
    actions: {
      description:
        'The toggle + Cancel cluster, built by the bar so both trees share one instance shape.',
    },
  },
} satisfies Meta<typeof CondensedBar>;

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
  rateLimit: { remaining: 480, limit: 600, low: false },
  processed: 0,
  failed: 0,
  isCancelling: false,
  canCancel: false,
  buckets: [],
  lowThresholdPercent: 10,
  operations: [],
  now: 1_760_000_000_000,
};

const actions = (
  <Button variant="danger" size="sm" disabled>
    Cancel
  </Button>
);

/** Idle, with a running total of what the scheduler has processed. */
export const Idle: Story = {
  args: { view: { ...base, processed: 118, failed: 3 }, actions },
};

/** A named operation running: the tally is replaced by live progress. */
export const Running: Story = {
  args: {
    view: {
      ...base,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Removing members',
      current: 42,
      total: 120,
      opFailed: 1,
      canCancel: true,
    },
    actions: (
      <Button variant="danger" size="sm">
        Cancel
      </Button>
    ),
  },
};

/** Low headroom, called out in words as well as colour. */
export const LowHeadroom: Story = {
  args: {
    view: {
      ...base,
      statusLabel: 'Cooldown',
      statusColorVar: 'var(--color-danger)',
      busy: true,
      rateLimit: { remaining: 18, limit: 600, low: true },
      processed: 964,
    },
    actions,
  },
};
