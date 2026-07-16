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
  parameters: { layout: 'centered' },
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

/** Default with no label. */
export const Default: Story = {};

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
export const WithError: Story = {
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
