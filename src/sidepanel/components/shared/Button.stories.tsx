import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Button from './Button';

/**
 * The primary text button primitive — five variants, three sizes, optional
 * icon/loading/badge. Prefer this over a hand-rolled `<button>`.
 */
const meta = {
  title: 'Shared/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    children: 'Add group',
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default (secondary) treatment. */
export const Default: Story = {};

/** The high-emphasis call to action. */
export const Primary: Story = {
  args: { variant: 'primary', icon: 'plus' },
};

/** Destructive action styling. */
export const Danger: Story = {
  args: { variant: 'danger', children: 'Remove members' },
};

/** Low-emphasis, chromeless. */
export const Ghost: Story = {
  args: { variant: 'ghost' },
};

/** Disabled state. */
export const Disabled: Story = {
  args: { disabled: true },
};

/** Spinner shown while an action is in flight (also disables the button). */
export const Loading: Story = {
  args: { variant: 'primary', loading: true },
};

/** Trailing count badge. */
export const WithBadge: Story = {
  args: { variant: 'primary', badge: '3' },
};

/** The three size steps side by side. */
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
  args: { variant: 'primary' },
};
