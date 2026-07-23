import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Icon from '../overview/shared/Icon';
import IconButton from './IconButton';

/** Icon-only button primitive — three variants and two sizes, optionally a toggle. */
const meta = {
  title: 'Shared/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Icon-only button primitive (close, remove, clear, expand) — the `label` prop is required and becomes the button’s accessible name (`aria-label`) plus default tooltip.\n\n' +
          'Three low-emphasis variants (`ghost`, `subtle`, `danger`) and two sizes. Can act as a toggle via `active` (reflected as `aria-pressed`), and supports a disabled state. For text CTAs use `Button`; for filter chips use `FilterPill`.',
      },
    },
  },
  argTypes: {
    label: { description: 'Accessible name — required. Also the default tooltip.' },
    onClick: { description: 'Click handler.' },
    children: {
      description: 'The icon to render (an `<svg>` or `<Icon />`); it controls its own dimensions.',
    },
    variant: {
      description:
        'Low-emphasis treatment: `ghost` and `subtle` differ in hover intensity; `danger` hovers red.',
    },
    size: { description: '`sm` (p-1) or `md` (p-1.5) padding around the glyph.' },
    disabled: { description: 'Disables the button and dims it.' },
    type: { description: 'Native button type. Defaults to `button`.' },
    title: { description: 'Tooltip text; defaults to `label`.' },
    active: { description: 'For toggle buttons — reflected as `aria-pressed`.' },
    className: { description: 'Extra classes merged onto the button.' },
  },
  args: {
    label: 'Close',
    onClick: fn(),
    children: <Icon type="trash" />,
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Ghost variant — lowest emphasis. */
export const Default: Story = {
  args: { variant: 'ghost' },
};

/**
 * Icon-only buttons have no visible text, so the required `label` supplies the
 * accessible name (rendered as `aria-label`). This story makes that contract
 * explicit; the a11y addon verifies the button is reachable by name.
 */
export const AccessibleName: Story = {
  args: { label: 'Remove member', variant: 'danger' },
  parameters: {
    a11y: {
      // The whole point of this story: the icon button exposes an accessible name.
      config: { rules: [{ id: 'button-name', enabled: true }] },
    },
  },
};

/** Subtle variant — slightly higher emphasis. */
export const Subtle: Story = {
  args: { variant: 'subtle' },
};

/** Danger variant — hovers red. */
export const Danger: Story = {
  args: { variant: 'danger', label: 'Delete' },
};

/** Disabled state. */
export const Disabled: Story = {
  args: { disabled: true },
};

/** Toggle button — aria-pressed set when active. */
export const Active: Story = {
  args: { active: true, label: 'Settings active' },
};

/** Small padding. */
export const Small: Story = {
  args: { size: 'sm' },
};

/** Medium padding (default). */
export const Medium: Story = {
  args: { size: 'md' },
};

/** Three sizes side by side. */
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <IconButton {...args} size="sm" label="Small">
        <Icon type="trash" size="sm" />
      </IconButton>
      <IconButton {...args} size="md" label="Medium">
        <Icon type="trash" />
      </IconButton>
    </div>
  ),
};

/** All three variants side by side. */
export const Variants: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <IconButton {...args} variant="ghost" label="Ghost">
        <Icon type="trash" />
      </IconButton>
      <IconButton {...args} variant="subtle" label="Subtle">
        <Icon type="trash" />
      </IconButton>
      <IconButton {...args} variant="danger" label="Delete">
        <Icon type="trash" />
      </IconButton>
    </div>
  ),
};

/** Hover state (forced via the pseudo-states addon). */
export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
};

/** Focus-visible state (forced via the pseudo-states addon). */
export const Focus: Story = {
  parameters: { pseudo: { focusVisible: true } },
};
