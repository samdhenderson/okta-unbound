import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Select from './Select';

/**
 * Controlled native select dropdown with label and error state.
 */
const meta = {
  title: 'Shared/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Controlled native `<select>` dropdown built from an options array, with label and error state.\n\n' +
          '`onChange` receives the chosen option value (not the event). When `error` is set the control turns red and shows the message below. Prefer this over a hand-rolled `<select>`; for free text use `Input`.',
      },
    },
  },
  argTypes: {
    value: { description: 'Controlled selected value.' },
    onChange: { description: 'Called with the newly selected option value.' },
    options: { description: 'Options to render.' },
    label: { description: 'Optional label rendered above the control.' },
    ariaLabel: {
      description:
        'Accessible name for the control when no visible `label` is rendered (e.g. an inline selector).',
    },
    error: {
      description: 'Error message; when set, applies danger styling and shows the message below.',
    },
    disabled: { description: 'Disables the control.' },
    fullWidth: { description: 'Stretch to fill the container width. Defaults to `true`.' },
    className: { description: 'Extra classes merged onto the outer container.' },
  },
  args: {
    value: 'ACTIVE',
    onChange: fn(),
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'STAGED', label: 'Staged' },
      { value: 'PROVISIONED', label: 'Provisioned' },
      { value: 'SUSPENDED', label: 'Suspended' },
      { value: 'DEPROVISIONED', label: 'Deprovisioned' },
    ],
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default with no visible label (uses `ariaLabel` for an accessible name). */
export const Default: Story = {
  args: {
    ariaLabel: 'User status',
  },
};

/** With label. */
export const WithLabel: Story = {
  args: {
    label: 'User Status',
  },
};

/** With aria-label for accessibility (no visible label). */
export const WithAriaLabel: Story = {
  args: {
    ariaLabel: 'User status selector',
  },
};

/** With error message. */
export const ErrorState: Story = {
  args: {
    label: 'User Status',
    error: 'This field is required',
  },
};

/** Disabled state. */
export const Disabled: Story = {
  args: {
    label: 'User Status',
    disabled: true,
  },
};

/** Not full width. */
export const NotFullWidth: Story = {
  args: {
    label: 'Status',
    fullWidth: false,
  },
};

/** Different selected value. */
export const Suspended: Story = {
  args: {
    label: 'User Status',
    value: 'SUSPENDED',
  },
};
