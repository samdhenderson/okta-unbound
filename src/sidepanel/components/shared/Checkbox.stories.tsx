import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { useState } from 'react';
import Checkbox from './Checkbox';

/** Controlled checkbox primitive — renders bare or with label + description. */
const meta = {
  title: 'Shared/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    checked: false,
    onChange: fn(),
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Bare checkbox without label (caller owns layout). */
export const Default: Story = {
  args: {
    'aria-label': 'Bare checkbox',
  },
};

/** Checked state. */
export const Checked: Story = {
  args: {
    checked: true,
    'aria-label': 'Bare checkbox',
  },
};

/** With label text. */
export const WithLabel: Story = {
  args: {
    label: 'Include deprovisioned users',
  },
};

/** With label and description text. */
export const WithDescription: Story = {
  args: {
    label: 'Include deprovisioned users',
    description: 'Also match users whose Okta status is DEPROVISIONED',
  },
};

/** Disabled state. */
export const Disabled: Story = {
  args: {
    disabled: true,
    label: 'Unavailable option',
  },
};

/** Disabled and checked. */
export const DisabledChecked: Story = {
  args: {
    checked: true,
    disabled: true,
    label: 'Locked option',
    description: 'This option cannot be changed',
  },
};

/** Live wrapper so the controlled-toggle story owns its own checked state. */
const ControlledCheckbox = () => {
  const [checked, setChecked] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Checkbox
        checked={checked}
        onChange={setChecked}
        label="Toggle me"
        description="Click to see state change"
      />
      <p className="text-xs text-neutral-600">Current state: {checked ? 'checked' : 'unchecked'}</p>
    </div>
  );
};

/** Controlled component demo showing toggle behavior. */
export const ControlledDemo: Story = {
  render: () => <ControlledCheckbox />,
};
