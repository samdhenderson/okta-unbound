import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UserSearchBar from './UserSearchBar';

/** Controlled search input for user search, with an inline spinner and clear button. */
const meta = {
  title: 'Users/UserSearchBar',
  component: UserSearchBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Controlled search input for user search, with an inline spinner and a clear button.\n\n' +
          'Fully controlled by the parent: it renders the current query, shows an inline loading indicator while a search is in flight, and exposes a clear (×) button that both clears the query and refocuses the input. Placeholder text is customizable.',
      },
    },
  },
  args: {
    searchQuery: '',
    onSearchChange: fn(),
    onClear: fn(),
    isSearching: false,
    showClearButton: false,
  },
  argTypes: {
    searchQuery: { description: 'Current search text (controlled).' },
    onSearchChange: { description: 'Called with the new query on every keystroke.' },
    onClear: { description: 'Clears the query; also refocuses the input.' },
    isSearching: { description: 'When true, shows the inline loading spinner.' },
    showClearButton: { description: 'When true, shows the clear (×) button.' },
    placeholder: {
      description: 'Placeholder text; defaults to a generic email/name/login hint.',
    },
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
