import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import EntityChooser, { CHOOSER_VISIBLE_LIMIT, type EntityChoice } from './EntityChooser';

const GROUPS: EntityChoice[] = [
  { id: '00gFAKE01', name: 'AWS Sandbox 2019', detail: '0 members' },
  { id: '00gFAKE11', name: 'Salesforce Users', detail: '412 members' },
  { id: '00gFAKE21', name: 'Engineering – All', detail: '1,204 members' },
  { id: '00gFAKE31', name: 'Contractors – Q3 pilot', detail: '17 members' },
];

const meta = {
  title: 'Home/EntityChooser',
  component: EntityChooser,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Pick one entity out of a list already in memory, and hand its id back — the launcher ' +
          'half of a scoped, opt-in action.\n\n' +
          'It **filters; it never searches**. Everything offered arrives through `choices`, and ' +
          'typing narrows that array locally. There is deliberately no async source and no ' +
          '`onFilterChange`: a chooser that queried Okta per keystroke would spend requests to ' +
          'avoid spending requests, which is the whole reason the surface is a chooser and not a ' +
          'count.\n\n' +
          'The visible cap is stated, never silent. A list quietly cut to its first page reads as ' +
          'the complete answer — here, as "your group is not in this org".',
      },
    },
  },
  args: {
    choices: GROUPS,
    filterLabel: 'Filter groups',
    actionLabel: 'Scan MFA coverage for this group',
    onChoose: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-md bg-neutral-50 p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EntityChooser>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Everything on offer, unfiltered. Pressing a row hands its id back once. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(GROUPS.length);
    await userEvent.click(canvas.getByRole('button', { description: 'Salesforce Users' }));
    await expect(args.onChoose).toHaveBeenCalledWith('00gFAKE11');
  },
};

/** Typing narrows the rows already in memory — no request, at any keystroke. */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Filter groups' }), 'contract');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1);
    await expect(canvas.getByText('Contractors – Q3 pilot')).toBeInTheDocument();
  },
};

/**
 * Nothing matches. The chooser says so in the caller's own words rather than
 * rendering an empty list that looks like a still-loading one.
 */
export const NoMatches: Story = {
  args: { emptyLabel: 'No group matches that name.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Filter groups' }), 'zzzz');
    await expect(canvas.queryByRole('listitem')).not.toBeInTheDocument();
    await expect(canvas.getByText('No group matches that name.')).toBeInTheDocument();
  },
};

/**
 * A big org. Only the first {@link CHOOSER_VISIBLE_LIMIT} rows render, and the
 * line under them says so — the filter field, not a longer list, is how a reader
 * reaches row 400.
 */
export const Capped: Story = {
  args: {
    choices: Array.from({ length: 400 }, (_, i) => ({
      id: `00gFAKE${i}`,
      name: `Project team ${i}`,
      detail: `${i} members`,
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(CHOOSER_VISIBLE_LIMIT);
    await expect(canvas.getByText(/Showing the first 25 of 400\./)).toBeInTheDocument();
  },
};

/** No `detail` line: the row is just a name, and still a full-height target. */
export const NamesOnly: Story = {
  args: { choices: GROUPS.map(({ id, name }) => ({ id, name })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('412 members')).not.toBeInTheDocument();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(GROUPS.length);
  },
};
