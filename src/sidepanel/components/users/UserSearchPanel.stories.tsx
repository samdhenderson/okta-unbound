import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UserSearchPanel from './UserSearchPanel';
import AlertMessage from '../shared/AlertMessage';
import { mockUsers } from '../../../test/mocks/fixtures';

/** The Users tab's search surface: search box, detected-user banner, results, empty state. */
const meta = {
  title: 'Users/UserSearchPanel',
  component: UserSearchPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Users tab\'s "find a user" surface: the search box, the manual-load detected-user banner, the search results and the pre-search empty state.\n\n' +
          "Purely presentational — the debounced query, the banner's visibility and the results are all owned by `useUsersTabState`, so this panel renders without touching Okta. Its parts render as siblings of the tab body (a fragment), and the `alerts` slot carries the tab's merged error / result banners between the search box and the results.\n\n" +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <Story />
      </div>
    ),
  ],
  args: {
    searchQuery: '',
    onSearchQueryChange: fn(),
    onClearSearch: fn(),
    isSearching: false,
    searchResults: [],
    onSelectUser: fn(),
    hasSelectedUser: false,
    hasError: false,
  },
  argTypes: {
    searchQuery: { description: 'Current search box value.' },
    onSearchQueryChange: {
      description: "Invoked on every keystroke; the caller's debounce decides when to search.",
    },
    onClearSearch: {
      description: "Clears the search, selection and banners (the search box's clear button).",
    },
    isSearching: { description: 'True while a debounced search is in flight.' },
    searchResults: {
      description: 'Latest committed search results; an empty array renders no results block.',
    },
    onSelectUser: { description: 'Invoked with the chosen user when a result row is clicked.' },
    hasSelectedUser: {
      description: 'Whether a user is selected — hides the results and the empty state.',
    },
    hasError: { description: 'Whether the tab is showing an error — suppresses the empty state.' },
    alerts: {
      description:
        "The tab's merged error / result banners, rendered between the search box and the results.",
    },
  },
} satisfies Meta<typeof UserSearchPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing searched yet — the empty state invites a search. */
export const Default: Story = {};

/** A query is being typed and its debounced search is in flight. */
export const Searching: Story = {
  args: { searchQuery: 'ada', isSearching: true },
};

/** Committed search results, each row selectable. */
export const WithResults: Story = {
  args: { searchQuery: 'ada', searchResults: mockUsers.slice(10, 14) },
};

/** The tab's merged error channel, rendered through the `alerts` slot. */
export const WithError: Story = {
  args: {
    searchQuery: 'ada',
    hasError: true,
    alerts: <AlertMessage message={{ text: 'Failed to search users', type: 'danger' }} />,
  },
};

/** A user is selected — the results and the empty state give way to the detail panel. */
export const UserSelected: Story = {
  args: { hasSelectedUser: true, searchResults: mockUsers.slice(10, 14) },
};

/**
 * The same rung at 360px — the width the compaction was for. Each result stays
 * two lines.
 *
 * Three detected-user stories used to sit here, and they went with the banner
 * itself (ADR-0022): the subject was deleted, not silenced. What it offered is
 * now the masthead's handoff affordance, whose own `ContextBar` stories cover
 * the offer, the decline and the return on a new entity.
 */
export const Compact360: Story = {
  args: {
    searchQuery: 'ada',
    searchResults: mockUsers.slice(10, 14),
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
