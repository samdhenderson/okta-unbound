import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ComparisonSearchPhase from './ComparisonSearchPhase';
import { mockUsers } from '../../../../test/mocks/fixtures';

const contextUser = mockUsers[0];

/** Phase 1 of the comparison modal: search for and pick the second user to compare against. */
const meta = {
  title: 'Users/Comparison/ComparisonSearchPhase',
  component: ComparisonSearchPhase,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Phase 1 of the comparison modal: search for and pick the second user to compare against.\n\n' +
          'Renders a controlled search box and the matching results (the context user is filtered out so users can\'t compare with themselves), and nothing else — the screen carries no intro card and no idle prompt. Shows a "Searching directory…" indicator while a search is in flight, and an empty state when a query returns no matches. Fully prop-driven; the parent hook owns the search.',
      },
    },
  },
  args: {
    contextUser,
    searchQuery: '',
    setSearchQuery: fn(),
    isSearching: false,
    searchResults: [],
    onSelectUser: fn(),
  },
  argTypes: {
    contextUser: {
      description:
        "The context user; excluded from results so users can't compare with themselves.",
    },
    searchQuery: { description: 'Current search text (controlled).' },
    setSearchQuery: { description: 'Updates the search text.' },
    isSearching: { description: 'When true, shows the "Searching directory…" indicator.' },
    searchResults: {
      description: 'Raw search results; the context user is filtered out before rendering.',
    },
    onSelectUser: { description: 'Invoked with the chosen user to enter the comparison phase.' },
  },
} satisfies Meta<typeof ComparisonSearchPhase>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Idle state: an empty query, so just the search box. */
export const Default: Story = {};

/** Search in flight, showing the "Searching directory…" indicator. */
export const Searching: Story = {
  args: { searchQuery: 'smith', isSearching: true },
};

/** Query typed with matching results listed (context user filtered out). */
export const WithResults: Story = {
  args: {
    searchQuery: 'user',
    searchResults: mockUsers.slice(0, 8),
  },
};

/** Query typed with no matches found. */
export const Empty: Story = {
  args: {
    searchQuery: 'zzzznomatch',
    searchResults: [],
  },
};
