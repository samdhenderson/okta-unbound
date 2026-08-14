import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import UserSearchResults from './UserSearchResults';
import { mockUsers } from '../../../test/mocks/fixtures';

/** Clickable list of user search results with per-user status badges. */
const meta = {
  title: 'Users/UserSearchResults',
  component: UserSearchResults,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Clickable list of user search results with per-user status badges.\n\n' +
          "Presentational: each row shows a user's name, email, login, and a status-colored badge, and clicking a row selects that user. Renders nothing when there are no results; the parent (UsersTab) owns the search itself. Results come from live Okta search via the scheduler path.\n\n" +
          'Each row is a `ListRow` rendered `as="button"` (ADR-0029). It was previously a `<div onClick>` with no role, no `tabIndex` and no focus ring, so results were unreachable by keyboard; the row is now tab-reachable, has a `focus-visible` ring and activates on Enter/Space.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), [Scheduler & messaging](?path=/docs/internals-scheduler-messaging--docs)',
      },
    },
  },
  args: {
    results: mockUsers.slice(10, 15),
    onSelectUser: fn(),
  },
  argTypes: {
    results: { description: 'Matching users to render; an empty array renders nothing.' },
    onSelectUser: { description: 'Invoked with the chosen user when a result row is clicked.' },
  },
} satisfies Meta<typeof UserSearchResults>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Several matching users, all active. */
export const Default: Story = {};

/** A single matching result; pluralization reflects the singular count. */
export const SingleResult: Story = {
  args: { results: mockUsers.slice(10, 11) },
};

/** Mixed statuses — active, suspended, and deprovisioned badges side by side. */
export const MixedStatuses: Story = {
  args: { results: [mockUsers[0], mockUsers[6], mockUsers[15]] },
};

/** No matching results — the component renders nothing. */
export const Empty: Story = {
  args: { results: [] },
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
  args: { results: mockUsers.slice(10, 12) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const [firstRow] = canvas.getAllByRole('button');

    await userEvent.tab();
    await expect(firstRow).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await expect(args.onSelectUser).toHaveBeenCalledWith(mockUsers[10]);
  },
};

/** A large result set to see the list scroll. */
export const ManyResults: Story = {
  args: { results: mockUsers.slice(0, 25) },
};
