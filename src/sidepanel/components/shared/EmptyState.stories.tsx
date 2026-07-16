import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import EmptyState from './EmptyState';

/** Centered placeholder — icon, title, description, and optional action buttons. */
const meta = {
  title: 'Shared/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    icon: 'search',
    title: 'No results found',
    description: 'Try adjusting your search or filter criteria',
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default without actions. */
export const Default: Story = {};

/** With a single primary action. */
export const WithAction: Story = {
  args: {
    actions: [
      {
        label: 'Clear Filters',
        onClick: fn(),
      },
    ],
  },
};

/** With multiple actions. */
export const WithMultipleActions: Story = {
  args: {
    actions: [
      {
        label: 'Clear Filters',
        onClick: fn(),
      },
      {
        label: 'Try Again',
        onClick: fn(),
        variant: 'secondary',
      },
    ],
  },
};

/** Empty list variant. */
export const EmptyList: Story = {
  args: {
    icon: 'users',
    title: 'No users yet',
    description: 'Start by adding your first user to this group',
    actions: [
      {
        label: 'Add User',
        onClick: fn(),
        variant: 'primary',
      },
    ],
  },
};

/** Error state variant. */
export const ErrorState: Story = {
  args: {
    icon: 'alert',
    title: 'Something went wrong',
    description: 'We encountered an error while loading your data',
    actions: [
      {
        label: 'Reload',
        onClick: fn(),
        variant: 'primary',
      },
    ],
  },
};

/** Lockout/permission state. */
export const NoPermission: Story = {
  args: {
    icon: 'lock',
    title: 'Access denied',
    description: 'You do not have permission to view this content',
  },
};

/** Secondary action variant. */
export const SecondaryAction: Story = {
  args: {
    icon: 'settings',
    title: 'No settings configured',
    description: 'Configure your preferences to get started',
    actions: [
      {
        label: 'Configure Now',
        onClick: fn(),
        variant: 'secondary',
      },
    ],
  },
};
