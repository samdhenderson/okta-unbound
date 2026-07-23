import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UserSearchResults from './UserSearchResults';
import { mockUsers } from '../../../test/mocks/handlers';

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

/** A large result set to see the list scroll. */
export const ManyResults: Story = {
  args: { results: mockUsers.slice(0, 25) },
};
