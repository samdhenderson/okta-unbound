import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import WorkingSetRow from './WorkingSetRow';

const DAY = 24 * 60 * 60 * 1000;

const meta = {
  title: 'Home/WorkingSetRow',
  component: WorkingSetRow,
  parameters: {
    docs: {
      description: {
        component:
          'One entity in the Home tab’s working set.\n\n' +
          'The row opens the entity **and** carries its own control, which a `<button>` row cannot ' +
          'legally contain — nesting one is an axe `nested-interactive` violation. So it uses the ' +
          'shared `StretchedButton` overlay rather than `ListRow as="button"`, with the trailing ' +
          'control on `relative z-10` above it.\n\n' +
          'The secondary line names the pane you left off on **when the rung reported one**. The ' +
          'design handoff’s worked example reads `Rule · left on Attributes`, which cannot be ' +
          'built: the Rules tab has no view stack and no panes. A rung with no pane shows its kind ' +
          'alone rather than an invented location.\n\n' +
          'The age is omitted for anything seen today — on a list you were just browsing, "today" ' +
          'on every row is a column that distinguishes nothing.',
      },
    },
  },
  argTypes: {
    entry: { description: 'The remembered entity.' },
    onOpen: { description: 'Open it on its owning tab.' },
    pinned: { description: 'Whether this is a pin — changes the drop verb from Forget to Unpin.' },
    onDrop: { description: 'Release a pin, or forget a recent.' },
  },
  args: {
    onOpen: fn(),
    onDrop: fn(),
    pinned: true,
    entry: {
      kind: 'group',
      id: '00gFAKE0000000000001',
      name: 'Engineering',
      lastPane: 'Members',
      lastSeenAt: Date.now(),
    },
  },
} satisfies Meta<typeof WorkingSetRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A pinned group, left on its Members pane earlier today. */
export const PinnedGroup: Story = {};

/** A recent user. The drop control says *Forget*, not *Unpin*. */
export const RecentUser: Story = {
  args: {
    pinned: false,
    entry: {
      kind: 'user',
      id: '00uFAKE0000000000001',
      name: 'Ada Lovelace',
      lastPane: 'Profile',
      lastSeenAt: Date.now() - 3 * DAY,
    },
  },
};

/** A rung that reported no pane: the line says what it is, and stops. */
export const NoPane: Story = {
  args: {
    entry: {
      kind: 'group',
      id: '00gFAKE0000000000002',
      name: 'Contractors',
      lastSeenAt: Date.now() - 8 * DAY,
    },
  },
};

/** A long name truncates rather than pushing the drop control off the row. */
export const LongName: Story = {
  args: {
    entry: {
      kind: 'group',
      id: '00gFAKE0000000000003',
      name: 'Engineering — Platform — Identity and Access Management — On-call rotation',
      lastPane: 'Insights',
      lastSeenAt: Date.now() - DAY,
    },
  },
};
