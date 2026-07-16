import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import SelectionChips from './SelectionChips';
import type { OktaUser } from '../../../shared/types';
import { mockUsers } from '../../../test/mocks/handlers';

// SelectionChips is generic over T; with `satisfies Meta<typeof SelectionChips>`
// TypeScript widens T to `unknown`, so the accessors narrow to OktaUser.
const asUser = (item: unknown) => item as OktaUser;

/**
 * Renders a set of selected items as removable chips.
 */
const meta = {
  title: 'Shared/SelectionChips',
  component: SelectionChips,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    items: [],
    getKey: (item: unknown) => asUser(item).id,
    getLabel: (item: unknown) => {
      const user = asUser(item);
      return `${user.profile.firstName} ${user.profile.lastName}`;
    },
    onRemove: fn(),
  },
} satisfies Meta<typeof SelectionChips>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty state. */
export const Empty: Story = {};

/** Empty with custom message. */
export const EmptyWithMessage: Story = {
  args: {
    emptyMessage: 'No users assigned',
  },
};

/** Single item. */
export const SingleItem: Story = {
  args: {
    items: [mockUsers[0]],
  },
};

/** Multiple items. */
export const MultipleItems: Story = {
  args: {
    items: mockUsers.slice(0, 3),
  },
};

/** Multiple items with clear all. */
export const WithClearAll: Story = {
  args: {
    items: mockUsers.slice(0, 5),
    onClearAll: fn(),
  },
};

/** Single item without clear all (only shows with >1 item). */
export const SingleNoHiddenClearAll: Story = {
  args: {
    items: [mockUsers[0]],
    onClearAll: fn(),
  },
};

/** Many items. */
export const ManyItems: Story = {
  args: {
    items: mockUsers.slice(0, 10),
    onClearAll: fn(),
  },
};
