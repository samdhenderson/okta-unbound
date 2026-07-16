import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UserSearchBar from './UserSearchBar';

/** Controlled search input for user search, with an inline spinner and clear button. */
const meta = {
  title: 'Users/UserSearchBar',
  component: UserSearchBar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    searchQuery: '',
    onSearchChange: fn(),
    onClear: fn(),
    isSearching: false,
    showClearButton: false,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UserSearchBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty input showing the placeholder. */
export const Default: Story = {};

/** Input with text entered; the clear button is now shown. */
export const WithQuery: Story = {
  args: { searchQuery: 'jane.doe@example.com', showClearButton: true },
};

/** Loading spinner shown while a search is in flight. */
export const Searching: Story = {
  args: { searchQuery: 'jane', showClearButton: true, isSearching: true },
};

/** Custom placeholder text. */
export const CustomPlaceholder: Story = {
  args: { placeholder: 'Find a user by employee ID...' },
};
