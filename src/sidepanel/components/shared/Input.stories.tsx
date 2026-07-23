import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Icon from '../overview/shared/Icon';
import Input from './Input';

/** Controlled single-line text field with label, hint, error, and optional icon. */
const meta = {
  title: 'Shared/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Controlled single-line text field with optional label, hint, leading icon, and error state.\n\n' +
          '`onChange` receives the string value (not the event). When `error` is set the field turns red and the error message replaces the hint. Supports labeled, hinted, error, disabled, and icon-adorned states. For multi-line use `Textarea`; for choices use `Select`.',
      },
    },
  },
  argTypes: {
    value: { description: 'Controlled value.' },
    onChange: { description: 'Called with the new string value on each change.' },
    placeholder: { description: 'Placeholder text shown when empty.' },
    type: { description: 'Native input type. Defaults to `text`.' },
    disabled: { description: 'Disables the field.' },
    error: { description: 'Error message; when set, applies danger styling and hides `hint`.' },
    label: { description: 'Optional field label rendered above the input.' },
    ariaLabel: {
      description:
        'Accessible name for the control when no visible `label` is rendered (e.g. an inline field).',
    },
    hint: { description: 'Helper text below the input, shown only when there is no `error`.' },
    fullWidth: { description: 'Stretch to fill the container width. Defaults to `true`.' },
    icon: { description: 'Optional leading icon rendered inside the field.' },
    className: { description: 'Extra classes merged onto the outer container.' },
    autoFocus: { description: 'Focus the input on mount.' },
    onKeyDown: {
      description: 'Key handler on the input (e.g. Enter to submit, Escape to cancel).',
    },
  },
  args: {
    value: '',
    onChange: fn(),
    placeholder: 'Enter text…',
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty input, no label. */
export const Default: Story = {};

/** With a text value. */
export const WithValue: Story = {
  args: { value: 'Sample text' },
};

/** With label. */
export const WithLabel: Story = {
  args: { label: 'Username' },
};

/** With label and hint text. */
export const WithHint: Story = {
  args: { label: 'Email address', hint: 'Use your company email' },
};

/** With error message (replaces hint). */
export const ErrorState: Story = {
  args: {
    label: 'Email address',
    value: 'invalid',
    error: 'Invalid email format',
  },
};

/** Disabled state. */
export const Disabled: Story = {
  args: {
    label: 'Locked field',
    value: 'Cannot edit',
    disabled: true,
  },
};

/** With leading icon. */
export const WithIcon: Story = {
  args: {
    label: 'Search groups',
    placeholder: 'Type to search…',
    icon: <Icon type="search" size="sm" />,
  },
};

/** Email type with label and hint. */
export const EmailType: Story = {
  args: {
    type: 'email',
    label: 'Email',
    placeholder: 'name@company.com',
    hint: 'We will never share your email',
  },
};

/** Password type with label. */
export const PasswordType: Story = {
  args: {
    type: 'password',
    label: 'Password',
    placeholder: '••••••••',
  },
};

/** Search type with icon. */
export const SearchType: Story = {
  args: {
    type: 'search',
    label: 'Search',
    placeholder: 'Find users…',
    icon: <Icon type="search" size="sm" />,
  },
};

/** Not full width. */
export const NotFullWidth: Story = {
  args: {
    label: 'City',
    placeholder: 'Type…',
    fullWidth: false,
  },
};
