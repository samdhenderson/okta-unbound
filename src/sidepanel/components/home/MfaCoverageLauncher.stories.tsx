import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import MfaCoverageLauncher from './MfaCoverageLauncher';
import type { EntityChoice } from './EntityChooser';

const CHOICES: EntityChoice[] = [
  { id: '00gFAKE01', name: 'AWS Sandbox 2019', detail: '0 members' },
  { id: '00gFAKE11', name: 'Salesforce Users', detail: '412 members' },
  { id: '00gFAKE21', name: 'Engineering – All', detail: '1,204 members' },
];

const meta = {
  title: 'Home/MfaCoverageLauncher',
  component: MfaCoverageLauncher,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Home's third report row, and the only one that is not free.\n\n" +
          'The two rows above it are joins over rows already on disk, so they state a number for ' +
          'the whole org at no cost. MFA coverage cannot be — it is a factor read per member — so ' +
          'this row inverts the shape: **scope first**. Choose a group from the snapshot (zero ' +
          'requests, no search per keystroke), then land on that group’s Insights pane with the ' +
          'scan armed and deliberately *not* started.\n\n' +
          'The cost is stated on the way in rather than discovered on arrival, and the read state ' +
          'of the group collection decides whether a chooser is offered at all.',
      },
    },
  },
  args: { choices: CHOICES, status: 'ok', onScan: fn() },
  decorators: [
    (Story) => (
      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200 bg-white">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof MfaCoverageLauncher>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed. A question, not an answer — and nothing has been read to show it. */
export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { expanded: false, name: /MFA coverage/ }),
    ).toBeInTheDocument();
    await expect(canvas.queryByRole('searchbox')).not.toBeInTheDocument();
  },
};

/** Opened: the cost first, then the chooser. Picking one hands the id back. */
export const Opened: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /MFA coverage/ }));
    await expect(canvas.getByText(/not free/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { description: 'Engineering – All' }));
    await expect(args.onScan).toHaveBeenCalledWith('00gFAKE21');
  },
};

/**
 * The group walk did not finish. Unlike a report, a partial list is still
 * usable — every group it names is real — so the chooser opens and says what it
 * cannot promise rather than refusing.
 */
export const Partial: Story = {
  args: { status: 'partial' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /MFA coverage/ }));
    await expect(canvas.getByText(/may simply be unread/)).toBeInTheDocument();
    await expect(canvas.getByRole('searchbox', { name: 'Filter groups' })).toBeInTheDocument();
  },
};

/**
 * Groups were never read. Inert and recessed: a filter field over zero rows
 * would read as "this org has no groups", which is the partial-served-as-
 * complete defect wearing a control's clothes.
 */
export const Unavailable: Story = {
  args: { choices: [], status: 'unavailable' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(canvas.getByText(/Groups have not been read yet/)).toBeInTheDocument();
  },
};

/** The first read is still in flight: a skeleton, never an empty chooser. */
export const Reading: Story = {
  args: { choices: [], status: 'reading' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};
