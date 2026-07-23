import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { useState } from 'react';
import Checkbox from './Checkbox';

/** Controlled checkbox primitive — renders bare or with label + description. */
const meta = {
  title: 'Shared/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Controlled checkbox primitive — renders bare or with a label + description.\n\n' +
          'When no `label` is given it emits a bare styled `<input>` so the caller owns layout (in that case supply `aria-label`); with a `label` it wraps the box in a clickable `<label>` plus optional helper text. Supports checked, unchecked, and disabled states.',
      },
    },
  },
  argTypes: {
    checked: { description: 'Controlled checked state.' },
    onChange: { description: 'Called with the new checked value on toggle.' },
    label: {
      description:
        'Visible label. When omitted, pass `aria-label` so the control has an accessible name.',
    },
    description: { description: 'Secondary helper text rendered beneath the label.' },
    disabled: { description: 'Disables the control and dims it.' },
    className: {
      description:
        'Extra classes for the wrapping `<label>` (when labeled) or the `<input>` (when bare).',
    },
  },
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
