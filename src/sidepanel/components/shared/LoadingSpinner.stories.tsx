import type { Meta, StoryObj } from '@storybook/react-vite';
import LoadingSpinner from './LoadingSpinner';

/** Spinning loading indicator with optional message and centering. */
const meta = {
  title: 'Shared/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LoadingSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Inline spinner, default size. */
export const Default: Story = {};

/** Small spinner. */
export const Small: Story = {
  args: { size: 'sm' },
};

/** Medium spinner (default). */
export const Medium: Story = {
  args: { size: 'md' },
};

/** Large spinner. */
export const Large: Story = {
  args: { size: 'lg' },
};

/** With a message below. */
export const WithMessage: Story = {
  args: { message: 'Loading data…' },
};

/** Centered with padding. */
export const Centered: Story = {
  args: { centered: true },
};

/** Centered with message. */
export const CenteredWithMessage: Story = {
  args: { size: 'lg', message: 'Please wait…', centered: true },
};

/** Three sizes for comparison. */
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
      <LoadingSpinner {...args} size="sm" />
      <LoadingSpinner {...args} size="md" />
      <LoadingSpinner {...args} size="lg" />
    </div>
  ),
};
