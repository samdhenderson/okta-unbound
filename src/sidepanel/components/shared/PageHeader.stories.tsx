import type { Meta, StoryObj } from '@storybook/react-vite';
import Button from './Button';
import PageHeader from './PageHeader';

/**
 * Top-of-view header bar with title, optional subtitle, status badge, and trailing actions.
 */
const meta = {
  title: 'Shared/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Groups',
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default with title only. */
export const Default: Story = {};

/** Title with a subtitle. */
export const WithSubtitle: Story = {
  args: {
    title: 'Groups',
    subtitle: 'Manage Okta group membership',
  },
};

/** With a primary badge. */
export const WithBadgePrimary: Story = {
  args: {
    title: 'Groups',
    badge: { text: 'Beta', variant: 'primary' },
  },
};

/** With a success badge. */
export const WithBadgeSuccess: Story = {
  args: {
    title: 'Groups',
    badge: { text: 'Active', variant: 'success' },
  },
};

/** With a warning badge. */
export const WithBadgeWarning: Story = {
  args: {
    title: 'Groups',
    badge: { text: 'Caution', variant: 'warning' },
  },
};

/** With an error badge. */
export const WithBadgeError: Story = {
  args: {
    title: 'Groups',
    badge: { text: 'Error', variant: 'error' },
  },
};

/** With trailing action button. */
export const WithActions: Story = {
  args: {
    title: 'Groups',
    actions: <Button icon="plus">New Group</Button>,
  },
};

/** Full: title, subtitle, badge, and actions. */
export const Full: Story = {
  args: {
    title: 'Groups',
    subtitle: 'Manage Okta group membership',
    badge: { text: 'Beta', variant: 'primary' },
    actions: <Button icon="plus">Add Group</Button>,
  },
};
