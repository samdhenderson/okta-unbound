import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Icon from '../shared/Icon';
import IconButton from './IconButton';
import Input from './Input';
import LoadingSpinner from './LoadingSpinner';

/** Controlled single-line text field with label, hint, error, size scale, and in-field adornments. */
const meta = {
  title: 'Shared/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Controlled single-line text field with optional label, hint, size scale, leading/trailing adornments, and error state.\n\n' +
          '`onChange` receives the string value (not the event). When `error` is set the field turns red and the error message replaces the hint. Supports labeled, hinted, error, disabled, and adorned states. For multi-line use `Textarea`; for choices use `Select`.\n\n' +
          'Three sizes (`sm ≈ 30px | md ≈ 38px | lg ≈ 46px`) and two in-field slots — `icon` (leading glyph) and `trailing` (clear button, spinner). Both reserve their padding automatically and scale with `size`, so a search composite composes this primitive instead of re-declaring the field class string. A `trailing` node is inert by default; set `trailingInteractive` when it holds a control.',
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
    size: {
      description:
        'Field height/type scale (`sm` ≈ 30px, `md` ≈ 38px, `lg` ≈ 46px). Defaults to `md`.',
    },
    icon: {
      description:
        'Optional leading icon rendered inside the field; left padding is reserved automatically.',
    },
    trailing: {
      description:
        'Optional node rendered inside the field at its trailing edge (clear button, spinner). Right padding is reserved automatically and scales with `size`.',
    },
    trailingInteractive: {
      description:
        'Set when `trailing` holds something the user clicks. By default the slot is `pointer-events-none` so a decorative adornment cannot swallow clicks aimed at the field.',
    },
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

/** The three size steps stacked, each with the leading icon so the reserved padding is visible. */
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
      <Input {...args} size="sm" ariaLabel="Small field" placeholder="sm — 30px" />
      <Input {...args} size="md" ariaLabel="Medium field" placeholder="md — 38px (default)" />
      <Input {...args} size="lg" ariaLabel="Large field" placeholder="lg — 46px" />
    </div>
  ),
  args: { icon: <Icon type="search" size="sm" /> },
};

/** The taller field a search bar uses as the primary control of a view. */
export const Large: Story = {
  args: {
    size: 'lg',
    label: 'Search users',
    placeholder: 'Search by email, name, or login…',
    icon: <Icon type="search" size="sm" />,
  },
};

/** Compact field for a dense toolbar row; lines up with `Button size="sm"`. */
export const Small: Story = {
  args: {
    size: 'sm',
    label: 'Filter',
    placeholder: 'Filter rows…',
  },
};

/** Trailing slot holding a clear button — needs `trailingInteractive` to be clickable. */
export const WithTrailing: Story = {
  args: {
    label: 'Search groups',
    value: 'engineering',
    trailingInteractive: true,
    trailing: (
      <IconButton label="Clear search" variant="ghost" size="sm" onClick={fn()}>
        <Icon type="close" size="sm" />
      </IconButton>
    ),
  },
};

/** Both slots at once: leading glyph plus a trailing clear button. */
export const WithIconAndTrailing: Story = {
  args: {
    size: 'lg',
    label: 'Search users',
    value: 'a-very-long-query-that-would-otherwise-run-under-the-clear-button@example.com',
    icon: <Icon type="search" size="sm" />,
    trailingInteractive: true,
    trailing: (
      <IconButton label="Clear search" variant="ghost" size="sm" onClick={fn()}>
        <Icon type="close" size="sm" />
      </IconButton>
    ),
  },
};

/** Search in flight: a decorative trailing spinner, left inert so clicks reach the field. */
export const Searching: Story = {
  args: {
    size: 'lg',
    label: 'Search users',
    value: 'ada',
    icon: <Icon type="search" size="sm" />,
    trailing: <LoadingSpinner size="sm" />,
  },
};

/** Error state at a non-default size. */
export const ErrorStateLarge: Story = {
  args: {
    size: 'lg',
    label: 'Email address',
    value: 'invalid',
    error: 'Invalid email format',
    icon: <Icon type="search" size="sm" />,
  },
};
