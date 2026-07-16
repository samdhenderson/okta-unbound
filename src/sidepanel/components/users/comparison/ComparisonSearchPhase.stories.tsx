import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ComparisonSearchPhase from './ComparisonSearchPhase';
import { mockUsers } from '../../../../test/mocks/handlers';

const contextUser = mockUsers[0];

/** Phase 1 of the comparison modal: search for and pick the second user to compare against. */
const meta = {
  title: 'Users/Comparison/ComparisonSearchPhase',
  component: ComparisonSearchPhase,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    contextUser,
    contextName: 'First1 Last1',
    searchQuery: '',
    setSearchQuery: fn(),
    isSearching: false,
    searchResults: [],
    onSelectUser: fn(),
  },
} satisfies Meta<typeof ComparisonSearchPhase>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Idle state: empty query, "Start typing to search" prompt. */
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
export const NoResults: Story = {
  args: {
    searchQuery: 'zzzznomatch',
    searchResults: [],
  },
};
