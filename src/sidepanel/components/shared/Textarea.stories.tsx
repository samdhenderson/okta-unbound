import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Textarea from './Textarea';

/**
 * Controlled multi-line text field with label, hint, and error state; vertically resizable.
 */
const meta = {
  title: 'Shared/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    value: '',
    onChange: fn(),
    placeholder: 'Enter text here...',
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default empty textarea. */
export const Default: Story = {};

/** With label and hint text. */
export const WithLabel: Story = {
  args: {
    label: 'Notes',
    hint: 'Add any relevant notes here',
    placeholder: 'Type your notes...',
  },
};

/** With error state. */
export const WithError: Story = {
  args: {
    value: 'Some invalid input',
    label: 'Notes',
    error: 'This field contains invalid characters',
  },
};

/** Disabled state. */
export const Disabled: Story = {
  args: {
    disabled: true,
    label: 'Notes',
    value: 'This field is disabled',
  },
};

/** Large textarea with 8 rows. */
export const LargeSize: Story = {
  args: {
    label: 'Description',
    rows: 8,
    placeholder: 'Enter a longer description...',
  },
};

/** Constrained width. */
export const ConstrainedWidth: Story = {
  args: {
    label: 'Comment',
    fullWidth: false,
    placeholder: 'Type a comment...',
  },
};
