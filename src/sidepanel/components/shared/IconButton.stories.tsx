import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Icon from '../overview/shared/Icon';
import IconButton from './IconButton';

/** Icon-only button primitive — three variants and two sizes, optionally a toggle. */
const meta = {
  title: 'Shared/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    label: 'Close',
    onClick: fn(),
    children: <Icon type="trash" />,
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Ghost variant — lowest emphasis. */
export const Default: Story = {
  args: { variant: 'ghost' },
};

/** Subtle variant — slightly higher emphasis. */
export const Subtle: Story = {
  args: { variant: 'subtle' },
};

/** Danger variant — hovers red. */
export const Danger: Story = {
  args: { variant: 'danger', label: 'Delete' },
};

/** Disabled state. */
export const Disabled: Story = {
  args: { disabled: true },
};

/** Toggle button — aria-pressed set when active. */
export const Active: Story = {
  args: { active: true, label: 'Settings active' },
};

/** Small padding. */
export const Small: Story = {
  args: { size: 'sm' },
};

/** Medium padding (default). */
export const Medium: Story = {
  args: { size: 'md' },
};

/** Three sizes side by side. */
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <IconButton {...args} size="sm" label="Small">
        <Icon type="trash" size="sm" />
      </IconButton>
      <IconButton {...args} size="md" label="Medium">
        <Icon type="trash" />
      </IconButton>
    </div>
  ),
};

/** All three variants side by side. */
export const Variants: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <IconButton {...args} variant="ghost" label="Ghost">
        <Icon type="trash" />
      </IconButton>
      <IconButton {...args} variant="subtle" label="Subtle">
        <Icon type="trash" />
      </IconButton>
      <IconButton {...args} variant="danger" label="Delete">
        <Icon type="trash" />
      </IconButton>
    </div>
  ),
};

/** Hover state (forced via the pseudo-states addon). */
export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
};

/** Focus-visible state (forced via the pseudo-states addon). */
export const Focus: Story = {
  parameters: { pseudo: { focusVisible: true } },
};
