import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import UserSearchResults from './UserSearchResults';
import type { OktaUser, UserStatus } from '../../../shared/types';

/** A fake directory covering every status the badge palette can render. */
const user = (n: number, first: string, last: string, status: UserStatus): OktaUser => ({
  id: `00uFAKE000${n}`,
  status,
  profile: {
    login: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    firstName: first,
    lastName: last,
  },
});

const active = user(1, 'Ada', 'Lovelace', 'ACTIVE');
const suspended = user(2, 'Grace', 'Hopper', 'SUSPENDED');
const provisioned = user(3, 'Alan', 'Turing', 'PROVISIONED');
const lockedOut = user(4, 'Katherine', 'Johnson', 'LOCKED_OUT');
const staged = user(5, 'Margaret', 'Hamilton', 'STAGED');
const deprovisioned = user(6, 'Annie', 'Easley', 'DEPROVISIONED');

const everyStatus = [active, suspended, provisioned, lockedOut, staged, deprovisioned];

/** Compact, clickable list of user search results under a quiet match count. */
const meta = {
  title: 'Users/UserSearchResults',
  component: UserSearchResults,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Compact, clickable list of user search results with per-user status badges.\n\n' +
          'Presentational: each row shows a name, an email and a shared `Badge` coloured by `userStatusVariant`, and clicking a row selects that user. Renders nothing when there are no results; the parent (`UsersTab`, or the comparison modal) owns the search itself. Results come from live Okta search via the scheduler path.\n\n' +
          'The block opens with one quiet `Eyebrow` reading `"{n} matches"`. It replaces an `<h3 className="text-lg font-semibold">Search Results</h3>` plus a separate count pill — two elements saying one thing, and together heavier than the `PageHeader` title above them.\n\n' +
          'Rows are `ListRow` at `compact` density rendered `as="button"` (ADR-0029): previously a `<div onClick>` with no role, no `tabIndex` and no focus ring, so results were unreachable by keyboard. They are two lines, not three — the old `Login:` mono line duplicated the email in every real case.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), [Scheduler & messaging](?path=/docs/internals-scheduler-messaging--docs)',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Story />
      </div>
    ),
  ],
  args: {
    results: [active, suspended, provisioned],
    onSelectUser: fn(),
  },
  argTypes: {
    results: { description: 'Matching users to render; an empty array renders nothing.' },
    onSelectUser: { description: 'Invoked with the chosen user when a result row is clicked.' },
  },
} satisfies Meta<typeof UserSearchResults>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Several matching users under the demoted match count. */
export const Default: Story = {};

/**
 * Every status the badge palette can render, side by side — the check that one
 * shared `Badge` covers what three hand-rolled palettes used to.
 */
export const MixedStatuses: Story = {
  args: { results: everyStatus },
};

/** A single matching result — the count reads `1 match`, not `1 matches`. */
export const SingleResult: Story = {
  args: { results: [active] },
};

/** No matching results — the component renders nothing at all, count included. */
export const Empty: Story = {
  args: { results: [] },
};

/**
 * At 360px the two lines truncate rather than wrap, and the status badge keeps
 * its width — the case where a third line per row was most expensive.
 */
export const Compact360: Story = {
  args: {
    results: [
      user(7, 'Bartholomew', 'Featherstonehaugh-Wintergreen', 'ACTIVE'),
      suspended,
      deprovisioned,
    ],
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};

/**
 * Keyboard reach — the defect ADR-0029 closes here.
 *
 * Tab moves onto the first result and Enter selects it. As a `<div onClick>` this
 * row took no focus at all, so a keyboard user could search but never open a
 * result. The focus ring is `focus-visible`, so it shows for the keyboard and not
 * for the mouse.
 */
export const KeyboardActivation: Story = {
  args: { results: [active, suspended] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const [firstRow] = canvas.getAllByRole('button');

    await userEvent.tab();
    await expect(firstRow).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await expect(args.onSelectUser).toHaveBeenCalledWith(active);
  },
};

/** A large result set to see the list scroll and the count grow. */
export const ManyResults: Story = {
  args: {
    results: Array.from({ length: 25 }, (_, i) =>
      user(100 + i, `First${i + 1}`, `Last${i + 1}`, i % 4 === 0 ? 'SUSPENDED' : 'ACTIVE'),
    ),
  },
};
