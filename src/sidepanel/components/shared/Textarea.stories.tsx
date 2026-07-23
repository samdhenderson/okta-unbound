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
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Controlled multi-line text field with label, hint, and error state; vertically resizable.\n\n' +
          'The multi-line sibling of `Input`. `onChange` receives the string value (not the event); when `error` is set the field turns red and the message replaces the hint. Supports labeled, hinted, error, disabled, and custom-row states. Prefer this over a raw `<textarea>`.',
      },
    },
  },
  argTypes: {
    value: { description: 'Controlled value.' },
    onChange: { description: 'Called with the new string value on each change.' },
    placeholder: { description: 'Placeholder text shown when empty.' },
    disabled: { description: 'Disables the field.' },
    error: { description: 'Error message; when set, applies danger styling and hides `hint`.' },
    label: { description: 'Optional label rendered above the field.' },
    hint: { description: 'Helper text below the field, shown only when there is no `error`.' },
    rows: { description: 'Visible row count. Defaults to `4`.' },
    fullWidth: { description: 'Stretch to fill the container width. Defaults to `true`.' },
    className: { description: 'Extra classes merged onto the outer container.' },
  },
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
export const ErrorState: Story = {
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
