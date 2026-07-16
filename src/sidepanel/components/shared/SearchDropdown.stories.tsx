import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import SearchDropdown from './SearchDropdown';
import type { OktaUser } from '../../../shared/types';
import { mockUsers } from '../../../test/mocks/handlers';

// SearchDropdown is generic over T; with `satisfies Meta<typeof SearchDropdown>`
// TypeScript widens T to `unknown`, so render/select callbacks receive `unknown`
// and narrow the item to OktaUser internally.
const asUser = (item: unknown) => item as OktaUser;

/**
 * Generic search input with live results dropdown and selected-item state.
 */
const meta = {
  title: 'Shared/SearchDropdown',
  component: SearchDropdown,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    placeholder: 'Search users...',
    query: '',
    onQueryChange: fn(),
    isSearching: false,
    results: [],
    showDropdown: false,
    onSelect: fn(),
    onClear: fn(),
    renderResult: (item: unknown) => {
      const user = asUser(item);
      return (
        <div>
          <div className="font-medium text-sm">
            {user.profile.firstName} {user.profile.lastName}
          </div>
          <div className="text-xs text-neutral-500">{user.profile.email}</div>
        </div>
      );
    },
  },
} satisfies Meta<typeof SearchDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default empty search. */
export const Default: Story = {};

/** With label and hint. */
export const WithLabel: Story = {
  args: {
    label: 'Source User',
    hint: 'Search by name or email',
  },
};

/** Searching state with spinner. */
export const Searching: Story = {
  args: {
    query: 'john',
    isSearching: true,
  },
};

/** With results dropdown visible. */
export const WithResults: Story = {
  args: {
    query: 'john',
    showDropdown: true,
    results: mockUsers.slice(0, 5),
  },
};

/** With query and clear button. */
export const WithQuery: Story = {
  args: {
    query: 'jane',
    showDropdown: false,
    results: [],
  },
};

/** Selected item state. */
export const Selected: Story = {
  args: {
    selectedItem: mockUsers[0],
    renderSelected: (item: unknown) => {
      const user = asUser(item);
      return (
        <div className="flex items-center gap-2">
          <div>
            <div className="text-sm font-medium">
              {user.profile.firstName} {user.profile.lastName}
            </div>
            <div className="text-xs text-neutral-600">{user.profile.email}</div>
          </div>
        </div>
      );
    },
  },
};

/** Selected with label. */
export const SelectedWithLabel: Story = {
  args: {
    label: 'Source User',
    selectedItem: mockUsers[0],
    renderSelected: (item: unknown) => {
      const user = asUser(item);
      return (
        <div className="flex items-center gap-2">
          <div>
            <div className="text-sm font-medium">
              {user.profile.firstName} {user.profile.lastName}
            </div>
            <div className="text-xs text-neutral-600">{user.profile.email}</div>
          </div>
        </div>
      );
    },
  },
};

/** Disabled state. */
export const Disabled: Story = {
  args: {
    disabled: true,
    label: 'Source User',
  },
};
