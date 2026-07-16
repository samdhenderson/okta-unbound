import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import StatCard from './StatCard';

/**
 * Single metric tile (title, value, optional icon) used in the Overview stat grids.
 */
const meta = {
  title: 'Overview/Shared/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    title: 'Active Users',
    value: 1250,
    onClick: fn(),
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default card with numeric value. */
export const Default: Story = {};

/** String value (no localization). */
export const StringValue: Story = {
  args: {
    value: 'N/A',
  },
};

/** With subtitle. */
export const WithSubtitle: Story = {
  args: {
    subtitle: 'Last updated today',
  },
};

/** With icon. */
export const WithIcon: Story = {
  args: {
    icon: 'users',
  },
};

/** Primary color variant. */
export const Primary: Story = {
  args: {
    color: 'primary',
    icon: 'bolt',
  },
};

/** Success color variant. */
export const Success: Story = {
  args: {
    color: 'success',
    title: 'Completed Tasks',
    value: 42,
    icon: 'check',
  },
};

/** Warning color variant. */
export const Warning: Story = {
  args: {
    color: 'warning',
    title: 'Pending Reviews',
    value: 8,
    icon: 'alert',
  },
};

/** Error color variant. */
export const Error: Story = {
  args: {
    color: 'error',
    title: 'Failed Requests',
    value: 3,
    icon: 'alert',
  },
};

/** Clickable card. */
export const Clickable: Story = {
  args: {
    title: 'Click me',
    value: 999,
    icon: 'chart',
  },
};

/** Large number with thousands separator. */
export const LargeNumber: Story = {
  args: {
    title: 'Total Records',
    value: 1234567,
    color: 'primary',
  },
};
