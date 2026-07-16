import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import QuickActionsPanel from './QuickActionsPanel';

/**
 * Collapsible, sectioned list of action buttons used on the Overview tabs.
 */
const meta = {
  title: 'Overview/Shared/QuickActionsPanel',
  component: QuickActionsPanel,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    sections: [
      {
        title: 'User Actions',
        icon: 'users',
        expanded: true,
        actions: [
          {
            label: 'Add User',
            icon: 'plus',
            variant: 'primary',
            onClick: fn(),
          },
          {
            label: 'Remove User',
            icon: 'trash',
            variant: 'danger',
            onClick: fn(),
          },
          {
            label: 'Edit User',
            icon: 'settings',
            onClick: fn(),
          },
        ],
      },
      {
        title: 'Group Actions',
        icon: 'building',
        expanded: true,
        actions: [
          {
            label: 'Create Group',
            icon: 'plus',
            variant: 'primary',
            onClick: fn(),
          },
          {
            label: 'Delete Group',
            icon: 'trash',
            variant: 'danger',
            onClick: fn(),
          },
        ],
      },
    ],
  },
} satisfies Meta<typeof QuickActionsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default with two sections. */
export const Default: Story = {};

/** With action badge (pending count). */
export const WithBadge: Story = {
  args: {
    sections: [
      {
        title: 'Pending Actions',
        icon: 'alert',
        actions: [
          {
            label: 'Review Requests',
            icon: 'clipboard-check',
            onClick: fn(),
            badge: '5',
          },
          {
            label: 'Approve',
            icon: 'check',
            variant: 'primary',
            onClick: fn(),
          },
        ],
      },
    ],
  },
};

/** With loading state. */
export const WithLoading: Story = {
  args: {
    sections: [
      {
        title: 'Actions',
        actions: [
          {
            label: 'Sync Data',
            icon: 'refresh',
            loading: true,
            onClick: fn(),
          },
          {
            label: 'Cancel',
            icon: 'minus',
            variant: 'ghost',
            onClick: fn(),
          },
        ],
      },
    ],
  },
};

/** With disabled state. */
export const WithDisabled: Story = {
  args: {
    sections: [
      {
        title: 'Admin Actions',
        actions: [
          {
            label: 'Reset Password',
            icon: 'key',
            variant: 'primary',
            onClick: fn(),
          },
          {
            label: 'Change Permissions',
            icon: 'shield',
            onClick: fn(),
            disabled: true,
          },
        ],
      },
    ],
  },
};

/** Collapsed section. */
export const Collapsed: Story = {
  args: {
    sections: [
      {
        title: 'Advanced Options',
        icon: 'settings',
        expanded: false,
        actions: [
          {
            label: 'Export Data',
            icon: 'download',
            onClick: fn(),
          },
          {
            label: 'Import Data',
            icon: 'download',
            onClick: fn(),
          },
        ],
      },
    ],
  },
};

/** Multiple sections with mixed states. */
export const MixedStates: Story = {
  args: {
    sections: [
      {
        title: 'Quick Actions',
        expanded: true,
        actions: [
          {
            label: 'Save',
            icon: 'check',
            variant: 'primary',
            onClick: fn(),
          },
          {
            label: 'Save',
            icon: 'check',
            variant: 'primary',
            loading: true,
            onClick: fn(),
          },
        ],
      },
      {
        title: 'Danger Zone',
        icon: 'alert',
        expanded: true,
        actions: [
          {
            label: 'Delete Everything',
            icon: 'trash',
            variant: 'danger',
            onClick: fn(),
          },
          {
            label: 'Deactivate',
            variant: 'danger',
            onClick: fn(),
            disabled: true,
          },
        ],
      },
      {
        title: 'Links',
        expanded: false,
        actions: [
          {
            label: 'Documentation',
            icon: 'link',
            variant: 'ghost',
            onClick: fn(),
          },
          {
            label: 'Support',
            icon: 'link',
            variant: 'ghost',
            onClick: fn(),
          },
        ],
      },
    ],
  },
};

/** All button variants in one section. */
export const AllVariants: Story = {
  args: {
    sections: [
      {
        title: 'Button Variants',
        actions: [
          {
            label: 'Primary',
            variant: 'primary',
            onClick: fn(),
          },
          {
            label: 'Secondary',
            variant: 'secondary',
            onClick: fn(),
          },
          {
            label: 'Danger',
            variant: 'danger',
            onClick: fn(),
          },
          {
            label: 'Ghost',
            variant: 'ghost',
            onClick: fn(),
          },
        ],
      },
    ],
  },
};

/** With tooltips. */
export const WithTooltips: Story = {
  args: {
    sections: [
      {
        title: 'Actions',
        actions: [
          {
            label: 'Sync Now',
            icon: 'refresh',
            onClick: fn(),
            tooltip: 'Synchronize with the latest data',
          },
          {
            label: 'Lock User',
            icon: 'lock',
            variant: 'danger',
            onClick: fn(),
            tooltip: 'This action cannot be undone',
          },
        ],
      },
    ],
  },
};
