import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Icon from '../overview/shared/Icon';
import Input from './Input';

/** Controlled single-line text field with label, hint, error, and optional icon. */
const meta = {
  title: 'Shared/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
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
export const WithError: Story = {
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
