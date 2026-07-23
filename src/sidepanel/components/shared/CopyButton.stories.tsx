import type { Meta, StoryObj } from '@storybook/react-vite';
import CopyButton from './CopyButton';

/** Copy-to-clipboard button that briefly confirms success by swapping icon + label. */
const meta = {
  title: 'Shared/CopyButton',
  component: CopyButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Copy-to-clipboard button that briefly confirms success by swapping its icon and label to `success` styling for ~1.5s.\n\n' +
          'Wraps the shared `Button`. Text is produced lazily via `getText()` on click, so large lists aren’t built until needed, and clipboard failures (blocked permissions / insecure context) fail silently rather than throwing.',
      },
    },
  },
  argTypes: {
    getText: {
      description:
        'Text to copy, computed lazily on click so large lists aren’t built until needed.',
    },
    label: { description: 'Idle label, e.g. “Copy all”.' },
    copiedLabel: { description: 'Label shown briefly after a successful copy.' },
    disabled: { description: 'Disables the button.' },
    title: { description: 'Native tooltip text for the button.' },
    variant: {
      description:
        'Idle-state button variant (the confirmed state always uses `success`). Defaults to `secondary`.',
    },
    size: { description: 'Button size passed through to `Button`. Defaults to `sm`.' },
    className: { description: 'Extra classes merged onto the button.' },
  },
  args: {
    getText: () => 'user1@example.com\nuser2@example.com\nuser3@example.com',
    label: 'Copy emails',
  },
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default small secondary button. */
export const Default: Story = {};

/** Primary variant. */
export const Primary: Story = {
  args: {
    variant: 'primary',
  },
};

/** Disabled state. */
export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

/** Medium size. */
export const Medium: Story = {
  args: {
    size: 'md',
  },
};

/** Large size. */
export const Large: Story = {
  args: {
    size: 'lg',
  },
};

/** With custom copied label. */
export const CustomCopiedLabel: Story = {
  args: {
    copiedLabel: 'Copied to clipboard!',
  },
};

/** With title tooltip. */
export const WithTitle: Story = {
  args: {
    title: 'Copy all selected user emails',
  },
};

/** All sizes together. */
export const AllSizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <CopyButton {...args} size="sm" label="Small" />
      <CopyButton {...args} size="md" label="Medium" />
      <CopyButton {...args} size="lg" label="Large" />
    </div>
  ),
  args: {
    variant: 'primary',
  },
};
